"""
warehouse_accounts.py
---------------------
Hệ thống tài khoản kho đa cấp (multi-level delegation).

So sánh với shop (flat 1 cấp):
  Shop  : owner → nhân viên (ShopEmployee, 1 cấp, owner quản tất)
  Kho   : admin → NV mảng kho → kho cấp 1 → cấp 2 → cấp 3
            └─ mỗi cấp được tạo bởi cấp trên, tracked qua created_by
            └─ admin thấy toàn bộ cây (BFS theo created_by)
            └─ mỗi cấp trung gian chỉ thấy cây con do mình tạo

Quy tắc tạo:
  - Admin / superadmin: tạo được bất kỳ tier
  - NV có warehouse_create_hub     → tạo được hub + district + ward
  - NV có warehouse_create_district → tạo được district + ward
  - NV có warehouse_create_ward    → tạo được ward (leaf)

Mỗi tài khoản mới nhận permissions để tiếp tục tạo cấp thấp hơn:
  hub      → [create_hub, create_district, create_ward]
  district → [create_district, create_ward]
  ward     → [] (leaf)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User, UserRole, Role
from app.models.shop import SystemEmployee, SystemEmployeePermission
from app.utils.security import hash_password

router = APIRouter()

# Permission code cho từng tier
TIER_PERM = {
    "hub":      "warehouse_create_hub",
    "district": "warehouse_create_district",
    "ward":     "warehouse_create_ward",
}

# Permissions được gán cho tài khoản mới tạo (để họ tiếp tục tạo cấp dưới)
TIER_GRANTS = {
    "hub":      ["warehouse_create_hub", "warehouse_create_district", "warehouse_create_ward"],
    "district": ["warehouse_create_district", "warehouse_create_ward"],
    "ward":     [],  # Leaf — không tạo thêm
}

# Role kho gán theo tier
TIER_ROLE = {
    "hub":      "warehouse_hub_manager",
    "district": "warehouse_district_manager",
    "ward":     "warehouse_ward_manager",
}

TIER_LABEL = {
    "hub": "Kho tổng (Tier 1)",
    "district": "Kho quận (Tier 2)",
    "ward": "Kho phường (Tier 3)",
}


def _user_roles(user: User) -> set:
    return {ur.role.role_name for ur in user.user_roles if ur.status == "active"}


def _emp_perms(user_id: int, db: Session) -> list:
    emp = db.query(SystemEmployee).filter_by(user_id=user_id, status="active").first()
    if not emp:
        return []
    return [p.permission_code for p in emp.permissions]


def _collect_subtree(root_id: int, all_emps: list) -> set:
    """BFS: tìm toàn bộ user_id con cháu của root_id theo chuỗi created_by."""
    result: set = set()
    queue = [root_id]
    while queue:
        cur = queue.pop(0)
        for emp in all_emps:
            if emp.created_by == cur and emp.user_id not in result:
                result.add(emp.user_id)
                queue.append(emp.user_id)
    return result


def _infer_tier(perms: list) -> str:
    """Suy ra tier từ permission list."""
    if "warehouse_create_hub" in perms:
        return "hub"
    if "warehouse_create_district" in perms:
        return "district"
    return "ward"


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CreateWHAccountIn(BaseModel):
    username: str   # → email: {username}@kho.test; password cũng = username
    full_name: str
    tier: str       # "hub" | "district" | "ward"


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("", summary="Tạo tài khoản kho mới (đa cấp)")
def create_warehouse_account(
    payload: CreateWHAccountIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Tạo tài khoản kho theo cấp:
    - Admin/superadmin: tạo được mọi tier
    - Sub-manager: chỉ tạo được tier mà mình có permission

    Tài khoản mới:
    - email = {username}@kho.test
    - password = username (dễ nhớ, username = password)
    - created_by = user_id của người đang tạo (KHÔNG hardcode admin)
    """
    my_roles = _user_roles(current_user)
    is_admin = "admin" in my_roles or "superadmin" in my_roles

    if payload.tier not in TIER_PERM:
        raise HTTPException(400, "tier phải là: hub | district | ward")

    if not is_admin:
        my_perms = _emp_perms(current_user.user_id, db)
        if TIER_PERM[payload.tier] not in my_perms:
            raise HTTPException(
                403,
                f"Không có quyền tạo tài khoản {TIER_LABEL[payload.tier]}",
            )

    # Validate username
    username = payload.username.strip()
    if not username or len(username) < 3:
        raise HTTPException(400, "Username phải có ít nhất 3 ký tự")

    email = f"{username}@kho.test"
    if db.query(User).filter_by(email=email).first():
        raise HTTPException(400, f"Username '{username}' đã tồn tại")

    # Tạo User — email = username@kho.test, password = username
    new_user = User(
        email=email,
        password_hash=hash_password(username),
        full_name=payload.full_name,
        status="active",
    )
    db.add(new_user)
    db.flush()

    # Gán role kho tương ứng
    role = db.query(Role).filter_by(role_name=TIER_ROLE[payload.tier]).first()
    if role:
        db.add(UserRole(
            user_id=new_user.user_id,
            role_id=role.role_id,
            current_role=True,
            assigned_by=current_user.user_id,
            status="active",
        ))

    # Tạo SystemEmployee — created_by = người đang thao tác (chain tracking)
    new_emp = SystemEmployee(
        user_id=new_user.user_id,
        emp_name=payload.full_name,
        role_name="warehouse_admin",
        status="active",
        created_by=current_user.user_id,  # ← CORE: tạo chuỗi cha-con
    )
    db.add(new_emp)
    db.flush()

    # Gán permissions để tiếp tục tạo cấp dưới (trừ leaf=ward)
    for pcode in TIER_GRANTS[payload.tier]:
        db.add(SystemEmployeePermission(
            emp_id=new_emp.emp_id,
            permission_code=pcode,
            scope="admin",
            granted_by=current_user.user_id,
        ))

    db.commit()
    db.refresh(new_emp)

    return {
        "user_id": new_user.user_id,
        "email": email,
        "tier": payload.tier,
        "tier_label": TIER_LABEL[payload.tier],
        "created_by": current_user.user_id,
        "message": f"Đã tạo tài khoản {TIER_LABEL[payload.tier]} thành công",
    }


@router.get("", summary="Danh sách tài khoản kho theo cây (admin thấy tất cả)")
def list_warehouse_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Trả về danh sách flat của cây tài khoản kho.
    Frontend dùng created_by để vẽ lại cây.

    - Admin/superadmin: thấy toàn bộ
    - Sub-manager: chỉ thấy cây con do mình (hoặc cấp dưới của mình) tạo
    """
    my_roles = _user_roles(current_user)
    is_admin = "admin" in my_roles or "superadmin" in my_roles

    all_emps = db.query(SystemEmployee).filter(
        SystemEmployee.role_name == "warehouse_admin"
    ).all()

    if is_admin:
        visible_ids = {e.user_id for e in all_emps}
    else:
        visible_ids = _collect_subtree(current_user.user_id, all_emps)

    result = []
    for emp in all_emps:
        if emp.user_id not in visible_ids:
            continue
        perms = [p.permission_code for p in emp.permissions]
        tier = _infer_tier(perms)

        # Tên người tạo
        creator_name = None
        if emp.created_by:
            creator = db.query(User).filter_by(user_id=emp.created_by).first()
            creator_name = creator.full_name if creator else None

        result.append({
            "user_id":      emp.user_id,
            "email":        emp.user.email if emp.user else None,
            "full_name":    emp.emp_name,
            "status":       emp.status,
            "created_by":   emp.created_by,
            "creator_name": creator_name,
            "created_at":   emp.created_at.isoformat() if emp.created_at else None,
            "permissions":  perms,
            "tier":         tier,
            "tier_label":   TIER_LABEL[tier],
        })

    return result


@router.patch("/{user_id}/status", summary="Kích hoạt / vô hiệu tài khoản kho")
def toggle_wh_account_status(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    my_roles = _user_roles(current_user)
    is_admin = "admin" in my_roles or "superadmin" in my_roles
    if not is_admin:
        raise HTTPException(403, "Chỉ admin mới có thể đổi trạng thái tài khoản kho")

    emp = db.query(SystemEmployee).filter_by(user_id=user_id, role_name="warehouse_admin").first()
    if not emp:
        raise HTTPException(404, "Không tìm thấy tài khoản kho")

    emp.status = "inactive" if emp.status == "active" else "active"
    db.commit()
    return {"user_id": user_id, "status": emp.status}
