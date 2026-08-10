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

Quy tắc tạo (2 cấp phân quyền, KHÔNG cascading tiếp):
  - Admin / superadmin: tạo được bất kỳ tier, kể cả "dept" (Quản lý tổng)
  - "dept" (Quản lý tổng)  → chỉ admin tạo được. Nhận đủ 3 quyền tạo hub/district/ward.
  - hub / district / ward → do dept (hoặc admin) tạo. KHÔNG nhận quyền tạo tiếp
                            (leaf — không tự tạo thêm tài khoản nào khác).
"""
import re
import unicodedata

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User, UserRole, Role
from app.models.shop import SystemEmployee, SystemEmployeePermission
from app.models.shipment import Warehouse, WarehouseManager
from app.utils.security import hash_password

router = APIRouter()

# Số tier tương ứng với từng tier string — dùng để khớp với Warehouse.tier (1/2/3)
TIER_NUM = {"hub": 1, "district": 2, "ward": 3}


def _strip_diacritics(s: str) -> str:
    """Bỏ dấu tiếng Việt, kể cả đ/Đ (không thuộc diện NFD tách dấu chuẩn)."""
    s = s.replace("đ", "d").replace("Đ", "D")
    nfkd = unicodedata.normalize("NFD", s)
    return "".join(c for c in nfkd if unicodedata.category(c) != "Mn")


def _warehouse_code(warehouse: "Warehouse") -> str:
    """
    Sinh 'mã kho' viết tắt từ tên kho, dùng cho email tự động.
    VD: "Kho Hồ Chí Minh" → "HCM", "Kho Quận 1" → "Q1", "Kho Quận 10" → "Q10".

    Số giữ nguyên CẢ CHUỖI (không chỉ lấy ký tự đầu) — nếu chỉ lấy chữ số đầu
    thì "Quận 1" và "Quận 10" đều ra "Q1", gây trùng email giữa 2 kho khác nhau.
    """
    name = _strip_diacritics(warehouse.name or "")
    # Bỏ tiền tố "Kho " nếu có (không phân biệt hoa/thường)
    name = re.sub(r"^\s*kho\s+", "", name, flags=re.IGNORECASE)
    words = re.findall(r"[A-Za-z0-9]+", name)
    code = "".join(w.upper() if w.isdigit() else w[0].upper() for w in words if w)
    return code or f"W{warehouse.warehouse_id}"

# Permission code cần có để tạo tài khoản ở tier tương ứng
# (tier "dept" không cần permission — chỉ admin mới tạo được)
TIER_PERM = {
    "hub":      "warehouse_create_hub",
    "district": "warehouse_create_district",
    "ward":     "warehouse_create_ward",
}

# Permissions được gán cho tài khoản mới tạo.
# Chỉ "dept" (Quản lý tổng) nhận quyền tạo tiếp — hub/district/ward là leaf.
TIER_GRANTS = {
    "dept":     ["warehouse_create_hub", "warehouse_create_district", "warehouse_create_ward"],
    "hub":      [],
    "district": [],
    "ward":     [],
}

# Role kho gán theo tier — "dept" (Quản lý tổng) dùng role "Admin_emp" (trước
# đây tên "warehouse_manager", đổi tên cho rõ nghĩa: đây là nhân viên nội bộ
# do admin tạo, không phải khách hàng — xem middleware/auth.py::EMPLOYMENT_ROLES).
# hub/district/ward dùng CHUNG role "employee" (giống nhân viên shop) — 3 cấp
# này KHÔNG còn phân biệt qua role string riêng, mà qua WarehouseManager→
# Warehouse.tier (xem _infer_tier bên dưới).
TIER_ROLE = {
    "dept":     "Admin_emp",
    "hub":      "employee",
    "district": "employee",
    "ward":     "employee",
}

TIER_LABEL = {
    "dept": "Quản lý tổng",
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


WAREHOUSE_ROLE_NAMES = set(TIER_ROLE.values())   # {"Admin_emp", "employee"}


def _warehouse_role_name(user_id: int, db: Session) -> str | None:
    """Role kho (Admin_emp/employee) hiện đang active của user, nếu có.
    Với role "employee" — CHỈ tính là tài khoản kho nếu có SystemEmployee
    active gắn với user_id (phân biệt với nhân viên shop — ShopEmployee —
    cũng dùng role "employee" nhưng khác bảng phụ)."""
    ur = (
        db.query(UserRole)
        .join(Role, Role.role_id == UserRole.role_id)
        .filter(
            UserRole.user_id == user_id,
            UserRole.status == "active",
            Role.role_name.in_(WAREHOUSE_ROLE_NAMES),
        )
        .first()
    )
    if not ur:
        return None
    role_name = ur.role.role_name
    if role_name == "employee":
        emp = db.query(SystemEmployee).filter_by(user_id=user_id, status="active").first()
        if not emp:
            return None
    return role_name


def _infer_tier(user_id: int, db: Session, perms: list) -> str:
    """Suy ra tier:
    - "Admin_emp" (không gắn 1 kho cụ thể) → "dept"
    - "employee" + có kho thật qua WarehouseManager→Warehouse.tier → hub/district/ward
    - Fallback theo permission (dữ liệu cũ, chưa gắn kho)."""
    role_name = _warehouse_role_name(user_id, db)
    if role_name == "Admin_emp":
        return "dept"
    if role_name == "employee":
        wm = db.query(WarehouseManager).filter_by(manager_id=user_id).first()
        if wm:
            wh = db.query(Warehouse).filter_by(warehouse_id=wm.warehouse_id).first()
            if wh:
                return {1: "hub", 2: "district", 3: "ward"}.get(wh.tier, "ward")
    # Fallback cho dữ liệu cũ (tạo trước khi đổi sang mô hình 2 cấp)
    if "warehouse_create_hub" in perms:
        return "dept"
    if "warehouse_create_district" in perms:
        return "district"
    return "ward"


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CreateWHAccountIn(BaseModel):
    username: str   # tên tài khoản gốc admin nhập
    full_name: str
    tier: str       # "dept" | "hub" | "district" | "ward"
    warehouse_id: int | None = None  # BẮT BUỘC với hub/district/ward — kho thật được phụ trách


class GrantCreateIn(BaseModel):
    allow: bool


class AssignExistingIn(BaseModel):
    user_id: int
    tier: str       # "dept" | "hub" | "district" | "ward"
    warehouse_id: int | None = None  # BẮT BUỘC với hub/district/ward


# Quyền được cấp/thu hồi cho 1 tài khoản Hub (Tier 1) khi dept "mở khoá" cho nó
# tự tạo tài khoản cấp dưới. KHÔNG bao gồm warehouse_create_hub — hub không tạo hub khác.
HUB_GRANT_CODES = ["warehouse_create_district", "warehouse_create_ward"]


def _check_create_permission(current_user: User, db: Session, tier: str) -> bool:
    """Kiểm tra quyền tạo/gán tài khoản ở `tier` — trả về is_admin, raise 4xx nếu không đủ quyền."""
    my_roles = _user_roles(current_user)
    is_admin = "admin" in my_roles or "superadmin" in my_roles
    if tier not in TIER_ROLE:
        raise HTTPException(400, "tier phải là: dept | hub | district | ward")
    if tier == "dept":
        if not is_admin:
            raise HTTPException(403, "Chỉ admin mới thao tác được với tài khoản Quản lý tổng")
    elif not is_admin:
        my_perms = _emp_perms(current_user.user_id, db)
        if TIER_PERM[tier] not in my_perms:
            raise HTTPException(403, f"Không có quyền với tài khoản {TIER_LABEL[tier]}")
    return is_admin


def _resolve_warehouse(db: Session, tier: str, warehouse_id: int | None) -> "Warehouse | None":
    """Tra kho thật theo warehouse_id, verify đúng cấp — None nếu tier='dept'."""
    if tier == "dept":
        return None
    if not warehouse_id:
        raise HTTPException(400, "Vui lòng chọn kho phụ trách")
    warehouse = db.query(Warehouse).filter_by(warehouse_id=warehouse_id).first()
    if not warehouse:
        raise HTTPException(404, "Không tìm thấy kho được chọn")
    if warehouse.tier != TIER_NUM[tier]:
        raise HTTPException(
            400,
            f"Kho '{warehouse.name}' là cấp {warehouse.tier}, không khớp với "
            f"{TIER_LABEL[tier]} (cấp {TIER_NUM[tier]})",
        )
    return warehouse


def _attach_warehouse_role(
    db: Session, user: User, full_name: str, tier: str, warehouse: "Warehouse | None", current_user: User,
) -> SystemEmployee:
    """
    Gán role kho + SystemEmployee (tạo mới hoặc tái kích hoạt nếu đã từng có) + liên kết
    WarehouseManager cho `user`. Dùng chung cho cả luồng "tạo tài khoản mới" và
    "gán tài khoản có sẵn".
    """
    role_name = TIER_ROLE[tier]
    role = db.query(Role).filter_by(role_name=role_name).first()
    if not role:
        role = Role(role_name=role_name, description=f"BuyZo — {TIER_LABEL[tier]}")
        db.add(role)
        db.flush()
    existing_ur = db.query(UserRole).filter_by(user_id=user.user_id, role_id=role.role_id).first()
    if existing_ur:
        existing_ur.status = "active"
        existing_ur.current_role = True
        existing_ur.assigned_by = current_user.user_id
    else:
        db.add(UserRole(
            user_id=user.user_id, role_id=role.role_id,
            current_role=True, assigned_by=current_user.user_id, status="active",
        ))

    emp = db.query(SystemEmployee).filter_by(user_id=user.user_id).first()
    if emp:
        emp.emp_name = full_name
        emp.role_name = "warehouse_admin"
        emp.status = "active"
        emp.created_by = current_user.user_id
        db.query(SystemEmployeePermission).filter_by(emp_id=emp.emp_id).delete(synchronize_session=False)
    else:
        emp = SystemEmployee(
            user_id=user.user_id, emp_name=full_name, role_name="warehouse_admin",
            status="active", created_by=current_user.user_id,
        )
        db.add(emp)
    db.flush()

    for pcode in TIER_GRANTS[tier]:
        db.add(SystemEmployeePermission(
            emp_id=emp.emp_id, permission_code=pcode, scope="admin", granted_by=current_user.user_id,
        ))

    if warehouse is not None:
        old_of_warehouse = db.query(WarehouseManager).filter_by(warehouse_id=warehouse.warehouse_id).first()
        if old_of_warehouse and old_of_warehouse.manager_id != user.user_id:
            db.delete(old_of_warehouse)
        old_of_user = db.query(WarehouseManager).filter_by(manager_id=user.user_id).first()
        if old_of_user and old_of_user.warehouse_id != warehouse.warehouse_id:
            db.delete(old_of_user)
        db.flush()
        link = db.query(WarehouseManager).filter_by(
            manager_id=user.user_id, warehouse_id=warehouse.warehouse_id
        ).first()
        if not link:
            db.add(WarehouseManager(manager_id=user.user_id, warehouse_id=warehouse.warehouse_id))

    return emp


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("", summary="Tạo tài khoản kho mới (đa cấp)")
def create_warehouse_account(
    payload: CreateWHAccountIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Tạo tài khoản kho — mô hình 2 cấp phân quyền (không cascading tiếp):
    - Admin/superadmin: tạo được mọi tier, kể cả "dept" (Quản lý tổng)
    - "dept": CHỈ admin mới tạo được
    - hub/district/ward: admin hoặc người có quyền tương ứng (do dept/admin cấp) tạo được.
      Tài khoản hub/district/ward tạo ra là leaf — không tự tạo thêm được ai.

    Tài khoản mới:
    - email = {username}@buyzo.com (tự động sinh từ tên tài khoản)
    - password = username (tự động, giống tài khoản đăng nhập)
    - created_by = user_id của người đang tạo (KHÔNG hardcode admin)
    """
    my_roles = _user_roles(current_user)
    is_admin = "admin" in my_roles or "superadmin" in my_roles

    if payload.tier not in TIER_ROLE:
        raise HTTPException(400, "tier phải là: dept | hub | district | ward")

    if payload.tier == "dept":
        if not is_admin:
            raise HTTPException(403, "Chỉ admin mới tạo được tài khoản Quản lý tổng")
    elif not is_admin:
        my_perms = _emp_perms(current_user.user_id, db)
        if TIER_PERM[payload.tier] not in my_perms:
            raise HTTPException(
                403,
                f"Không có quyền tạo tài khoản {TIER_LABEL[payload.tier]}",
            )

    # Validate username
    username = payload.username.strip()
    if not username:
        raise HTTPException(400, "Vui lòng nhập tài khoản")

    warehouse: Warehouse | None = None
    if payload.tier == "dept":
        # Quản lý tổng không gắn với 1 kho cụ thể (quản lý toàn hệ thống) —
        # giữ quy tắc cũ: email = {username}@buyzo.com, password = username.
        if len(username) < 6:
            raise HTTPException(400, "Tài khoản phải có ít nhất 6 ký tự")
        local_part = username
    else:
        if not payload.warehouse_id:
            raise HTTPException(400, "Vui lòng chọn kho phụ trách")
        warehouse = db.query(Warehouse).filter_by(warehouse_id=payload.warehouse_id).first()
        if not warehouse:
            raise HTTPException(404, "Không tìm thấy kho được chọn")
        if warehouse.tier != TIER_NUM[payload.tier]:
            raise HTTPException(
                400,
                f"Kho '{warehouse.name}' là cấp {warehouse.tier}, không khớp với "
                f"{TIER_LABEL[payload.tier]} (cấp {TIER_NUM[payload.tier]})",
            )
        # Quy tắc email: {tài khoản}+cap{cấp}+{mã kho}@buyzo.com — vd Kho + cap1 + HCM
        # = Khocap1HCM@buyzo.com. Mật khẩu = toàn bộ phần trước @ (giống tài khoản đăng nhập).
        code = _warehouse_code(warehouse)
        local_part = f"{username}cap{warehouse.tier}{code}"
        if len(local_part) < 6:
            raise HTTPException(400, "Tài khoản phải có ít nhất 6 ký tự")

    email = f"{local_part}@buyzo.com"
    existing_user = db.query(User).filter_by(email=email).first()
    if existing_user:
        existing_emp = db.query(SystemEmployee).filter_by(user_id=existing_user.user_id).first()
        if existing_emp and existing_emp.status == "active":
            raise HTTPException(400, f"Tài khoản '{local_part}' đã tồn tại và đang hoạt động")
        # User/SystemEmployee đã tồn tại nhưng đang bị vô hiệu hoá (đã "xoá" trước đó) —
        # kích hoạt lại thay vì báo lỗi trùng, tránh vi phạm UNIQUE constraint user_id.
        new_user = existing_user
        new_user.status = "active"
        new_user.password_hash = hash_password(local_part)
        new_user.full_name = payload.full_name
    else:
        # Tạo User — email tự sinh theo quy tắc ở trên, password = phần trước @
        new_user = User(
            email=email,
            password_hash=hash_password(local_part),
            full_name=payload.full_name,
            status="active",
        )
        db.add(new_user)
        db.flush()

    # Gán role kho tương ứng — tạo Role nếu chưa tồn tại (tránh bỏ sót âm thầm)
    role_name = TIER_ROLE[payload.tier]
    role = db.query(Role).filter_by(role_name=role_name).first()
    if not role:
        role = Role(role_name=role_name, description=f"BuyZo — {TIER_LABEL[payload.tier]}")
        db.add(role)
        db.flush()
    existing_ur = db.query(UserRole).filter_by(user_id=new_user.user_id, role_id=role.role_id).first()
    if existing_ur:
        existing_ur.status = "active"
        existing_ur.current_role = True
        existing_ur.assigned_by = current_user.user_id
    else:
        db.add(UserRole(
            user_id=new_user.user_id,
            role_id=role.role_id,
            current_role=True,
            assigned_by=current_user.user_id,
            status="active",
        ))

    # SystemEmployee — nếu user_id đã từng có bản ghi (kể cả đã bị vô hiệu hoá) thì
    # tái sử dụng & kích hoạt lại, tránh vi phạm UNIQUE constraint user_id.
    new_emp = db.query(SystemEmployee).filter_by(user_id=new_user.user_id).first()
    if new_emp:
        new_emp.emp_name = payload.full_name
        new_emp.role_name = "warehouse_admin"
        new_emp.status = "active"
        new_emp.created_by = current_user.user_id  # ← CORE: tạo chuỗi cha-con
        db.query(SystemEmployeePermission).filter_by(emp_id=new_emp.emp_id).delete(synchronize_session=False)
    else:
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

    # Gắn tài khoản vào đúng kho thật (WarehouseManager) — bỏ qua với tier="dept"
    # vì Quản lý tổng không phụ trách 1 kho cụ thể.
    if warehouse is not None:
        # 1 kho chỉ có 1 manager tại 1 thời điểm — gỡ manager cũ của kho này (nếu có)
        old_of_warehouse = db.query(WarehouseManager).filter_by(warehouse_id=warehouse.warehouse_id).first()
        if old_of_warehouse and old_of_warehouse.manager_id != new_user.user_id:
            db.delete(old_of_warehouse)
        # 1 user chỉ quản 1 kho tại 1 thời điểm — gỡ liên kết kho cũ của user này (nếu có)
        old_of_user = db.query(WarehouseManager).filter_by(manager_id=new_user.user_id).first()
        if old_of_user and old_of_user.warehouse_id != warehouse.warehouse_id:
            db.delete(old_of_user)
        db.flush()
        link = db.query(WarehouseManager).filter_by(
            manager_id=new_user.user_id, warehouse_id=warehouse.warehouse_id
        ).first()
        if not link:
            db.add(WarehouseManager(manager_id=new_user.user_id, warehouse_id=warehouse.warehouse_id))

    db.commit()
    db.refresh(new_emp)

    return {
        "user_id": new_user.user_id,
        "email": email,
        "password": local_part,
        "tier": payload.tier,
        "tier_label": TIER_LABEL[payload.tier],
        "warehouse_id": warehouse.warehouse_id if warehouse else None,
        "warehouse_name": warehouse.name if warehouse else None,
        "created_by": current_user.user_id,
        "message": f"Đã tạo tài khoản {TIER_LABEL[payload.tier]} thành công — Email: {email} — Mật khẩu: {local_part}",
    }


@router.get("/search-users", summary="Tìm người dùng có sẵn để gán làm quản lý kho")
def search_users_for_assignment(
    q: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cho phép ai đang có quyền tạo tài khoản kho (dept/hub-được-cấp-quyền/admin) tìm
    người dùng có sẵn theo tên/email, để gán thẳng vào 1 kho thay vì tạo tài khoản mới.
    """
    my_roles = _user_roles(current_user)
    is_admin = "admin" in my_roles or "superadmin" in my_roles
    if not is_admin and not _emp_perms(current_user.user_id, db):
        raise HTTPException(403, "Không có quyền tìm người dùng")

    q = q.strip()
    if len(q) < 2:
        return {"users": []}
    like = f"%{q}%"
    users = (
        db.query(User)
        .filter(User.status == "active")
        .filter(or_(User.full_name.ilike(like), User.email.ilike(like)))
        .order_by(User.full_name)
        .limit(15)
        .all()
    )
    return {"users": [
        {"user_id": u.user_id, "full_name": u.full_name, "email": u.email, "phone": u.phone}
        for u in users
    ]}


@router.post("/assign-existing", summary="Gán 1 tài khoản có sẵn làm quản lý kho")
def assign_existing_account(
    payload: AssignExistingIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Giống create_warehouse_account nhưng dùng lại 1 User đã tồn tại thay vì tạo mới."""
    _check_create_permission(current_user, db, payload.tier)
    warehouse = _resolve_warehouse(db, payload.tier, payload.warehouse_id)

    user = db.query(User).filter_by(user_id=payload.user_id).first()
    if not user:
        raise HTTPException(404, "Không tìm thấy người dùng")

    _attach_warehouse_role(db, user, user.full_name or "", payload.tier, warehouse, current_user)
    db.commit()

    return {
        "user_id": user.user_id,
        "email": user.email,
        "full_name": user.full_name,
        "tier": payload.tier,
        "tier_label": TIER_LABEL[payload.tier],
        "warehouse_id": warehouse.warehouse_id if warehouse else None,
        "warehouse_name": warehouse.name if warehouse else None,
        "message": f"Đã gán {user.full_name} làm {TIER_LABEL[payload.tier]} thành công",
    }


@router.get("/me", summary="Tier + quyền tạo tài khoản của chính người đang đăng nhập")
def my_warehouse_account_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Dùng ở FE để biết mình có phải tài khoản kho không, và nếu có thì tier
    nào (dept/hub/district/ward) — vd trang /hub/accounts, hoặc Navbar/
    LoginForm quyết định điều hướng cho role "employee" (role này dùng
    chung cho cả nhân viên shop lẫn nhân viên kho — is_warehouse=False nghĩa
    là đây KHÔNG phải tài khoản kho, FE nên xử lý như nhân viên shop bình
    thường thay vì đưa vào portal kho).
    """
    emp = db.query(SystemEmployee).filter_by(user_id=current_user.user_id, status="active").first()
    roles = _user_roles(current_user)
    if not emp and "Admin_emp" not in roles:
        return {"is_warehouse": False, "tier": None, "permissions": [], "can_create": []}
    perms = [p.permission_code for p in emp.permissions] if emp else []
    tier = _infer_tier(current_user.user_id, db, perms)
    return {"is_warehouse": True, "tier": tier, "permissions": perms, "can_create": [
        t for t, code in TIER_PERM.items() if code in perms
    ]}


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

    # Nhận diện "tài khoản kho" qua Role thực (Admin_emp/hub/district/ward),
    # KHÔNG dựa vào SystemEmployee.role_name nữa — để cả 2 luồng tạo (form riêng
    # + checkbox "Quản lý kho" trong trang Nhân viên hệ thống) đều hiện ra đồng nhất.
    all_emps = (
        db.query(SystemEmployee)
        .join(UserRole, UserRole.user_id == SystemEmployee.user_id)
        .join(Role, Role.role_id == UserRole.role_id)
        .filter(
            UserRole.status == "active",
            Role.role_name.in_(WAREHOUSE_ROLE_NAMES),
        )
        .distinct()
        .all()
    )

    if is_admin:
        visible_ids = {e.user_id for e in all_emps}
    else:
        visible_ids = _collect_subtree(current_user.user_id, all_emps)

    result = []
    for emp in all_emps:
        if emp.user_id not in visible_ids:
            continue
        perms = [p.permission_code for p in emp.permissions]
        tier = _infer_tier(emp.user_id, db, perms)

        # Tên người tạo
        creator_name = None
        if emp.created_by:
            creator = db.query(User).filter_by(user_id=emp.created_by).first()
            creator_name = creator.full_name if creator else None

        # Kho thật đang phụ trách (nếu có) — dept không gắn 1 kho cụ thể
        wm = db.query(WarehouseManager).filter_by(manager_id=emp.user_id).first()
        wh = db.query(Warehouse).filter_by(warehouse_id=wm.warehouse_id).first() if wm else None

        result.append({
            "user_id":       emp.user_id,
            "email":         emp.user.email if emp.user else None,
            "full_name":     emp.emp_name,
            "status":        emp.status,
            "created_by":    emp.created_by,
            "creator_name":  creator_name,
            "created_at":    emp.created_at.isoformat() if emp.created_at else None,
            "permissions":   perms,
            "tier":          tier,
            "tier_label":    TIER_LABEL[tier],
            "warehouse_id":  wh.warehouse_id if wh else None,
            "warehouse_name": wh.name if wh else None,
            "warehouse_province": wh.province if wh else None,
        })

    return result


@router.patch("/{user_id}/grant-create", summary="Cấp / thu hồi quyền tự tạo tài khoản cho 1 Hub (Tier 1)")
def grant_create_permission(
    user_id: int,
    payload: GrantCreateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Quản lý tổng (dept) cho phép MỘT Hub (Tier 1) do chính mình tạo được tự tạo
    tài khoản District/Ward cho city của họ. Admin cũng gọi được (override).

    - Chỉ áp dụng cho tài khoản tier="hub".
    - Chỉ người đã tạo ra hub đó (created_by) hoặc admin mới cấp/thu hồi được.
    - allow=True  → hub nhận warehouse_create_district + warehouse_create_ward
      (KHÔNG nhận warehouse_create_hub — hub không tự tạo hub khác).
    - allow=False → thu hồi 2 quyền trên.
    """
    my_roles = _user_roles(current_user)
    is_admin = "admin" in my_roles or "superadmin" in my_roles

    emp = db.query(SystemEmployee).filter_by(user_id=user_id).first()
    if not emp:
        raise HTTPException(404, "Không tìm thấy tài khoản kho")

    if not is_admin and emp.created_by != current_user.user_id:
        raise HTTPException(403, "Bạn chỉ cấp quyền được cho tài khoản do chính mình tạo")

    perms = [p.permission_code for p in emp.permissions]
    tier = _infer_tier(user_id, db, perms)
    if tier != "hub":
        raise HTTPException(400, "Chỉ cấp quyền tự tạo tài khoản được cho Kho tổng (Tier 1)")

    if payload.allow:
        existing = {p.permission_code for p in emp.permissions}
        for code in HUB_GRANT_CODES:
            if code not in existing:
                db.add(SystemEmployeePermission(
                    emp_id=emp.emp_id, permission_code=code, granted_by=current_user.user_id,
                ))
        message = "Đã cấp quyền tự tạo tài khoản District/Ward cho Hub này"
    else:
        db.query(SystemEmployeePermission).filter(
            SystemEmployeePermission.emp_id == emp.emp_id,
            SystemEmployeePermission.permission_code.in_(HUB_GRANT_CODES),
        ).delete(synchronize_session=False)
        message = "Đã thu hồi quyền tự tạo tài khoản của Hub này"

    db.commit()
    return {"user_id": user_id, "allow": payload.allow, "message": message}


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

    emp = db.query(SystemEmployee).filter_by(user_id=user_id).first()
    if not emp or not _warehouse_role_name(user_id, db):
        raise HTTPException(404, "Không tìm thấy tài khoản kho")

    emp.status = "inactive" if emp.status == "active" else "active"
    db.commit()
    return {"user_id": user_id, "status": emp.status}


@router.post("/{user_id}/reset-password", summary="Đặt lại mật khẩu tài khoản kho về mặc định")
def reset_warehouse_account_password(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Đặt lại mật khẩu về đúng quy ước mặc định của hệ thống (= phần trước @ trong
    email, giống lúc tạo). Admin đặt lại được cho MỌI tài khoản kho; người tạo
    (dept/hub được cấp quyền) chỉ đặt lại được cho tài khoản DO CHÍNH MÌNH tạo.
    """
    my_roles = _user_roles(current_user)
    is_admin = "admin" in my_roles or "superadmin" in my_roles

    emp = db.query(SystemEmployee).filter_by(user_id=user_id).first()
    if not emp or not _warehouse_role_name(user_id, db):
        raise HTTPException(404, "Không tìm thấy tài khoản kho")

    if not is_admin and emp.created_by != current_user.user_id:
        raise HTTPException(403, "Bạn chỉ đặt lại mật khẩu được cho tài khoản do chính mình tạo")

    user = db.query(User).filter_by(user_id=user_id).first()
    if not user:
        raise HTTPException(404, "Không tìm thấy người dùng")

    local_part = user.email.split("@")[0]
    user.password_hash = hash_password(local_part)
    db.commit()

    return {
        "user_id": user_id,
        "email": user.email,
        "password": local_part,
        "message": f"Đã đặt lại mật khẩu về mặc định cho {user.full_name}",
    }
