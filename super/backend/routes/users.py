"""
super/backend/routes/users.py
------------------------------
Superadmin — xem và can thiệp trực tiếp vào bảng users.
Không kiểm tra business rules, không ghi log.
"""
import random
import string
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User, UserRole, Role
from app.models.shop import ShopEmployee, Shop
from app.utils.security import hash_password
from super.middleware import require_super

router = APIRouter()


class UserPatch(BaseModel):
    email:     Optional[str] = None
    phone:     Optional[str] = None
    full_name: Optional[str] = None
    address:   Optional[str] = None
    status:    Optional[str] = None   # active/banned/deleted


class ResetPasswordRequest(BaseModel):
    new_password: Optional[str] = None   # Nếu None → tự sinh


def _user_dict(u: User, db: Session = None) -> dict:
    # Tìm shop của nhân viên (nếu có)
    shop_info = None
    if db:
        emp = db.query(ShopEmployee).filter(ShopEmployee.user_id == u.user_id).first()
        if emp:
            shop = db.query(Shop).filter(Shop.shop_id == emp.shop_id).first()
            shop_info = {
                "shop_id":   emp.shop_id,
                "shop_name": shop.shop_name if shop else None,
                "position":  emp.position,
                "emp_status": emp.status,
            }
    return {
        "user_id":    u.user_id,
        "email":      u.email,
        "phone":      u.phone,
        "full_name":  u.full_name,
        "address":    u.address,
        "status":     u.status,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "roles": [
            {"role_name": ur.role.role_name, "status": ur.status}
            for ur in u.user_roles
            if ur.role
        ],
        "shop_info": shop_info,   # None nếu không phải employee
    }


@router.get("")
def list_users(
    page:   int           = Query(1, ge=1),
    limit:  int           = Query(30, ge=1, le=200),
    status: Optional[str] = None,
    search: Optional[str] = None,
    _:      dict          = Depends(require_super),
    db:     Session       = Depends(get_db),
):
    q = db.query(User).options(joinedload(User.user_roles).joinedload(UserRole.role))
    if status and status != "all":
        q = q.filter(User.status == status)
    if search:
        q = q.filter(
            User.email.ilike(f"%{search}%") |
            User.full_name.ilike(f"%{search}%")
        )
    total = q.count()
    users = q.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"users": [_user_dict(u, db) for u in users], "total": total, "page": page}


@router.get("/{user_id}")
def get_user(
    user_id: int,
    _:   dict    = Depends(require_super),
    db:  Session = Depends(get_db),
):
    u = db.query(User).options(joinedload(User.user_roles).joinedload(UserRole.role)).filter(User.user_id == user_id).first()
    if not u:
        raise HTTPException(404, "Không tìm thấy user")
    return _user_dict(u, db)


@router.patch("/{user_id}")
def patch_user(
    user_id: int,
    data:  UserPatch,
    _:     dict    = Depends(require_super),
    db:    Session = Depends(get_db),
):
    """Cập nhật thông tin user trực tiếp — không qua business layer."""
    u = db.query(User).filter(User.user_id == user_id).first()
    if not u:
        raise HTTPException(404, "Không tìm thấy user")

    changes = data.model_dump(exclude_none=True)
    for field, value in changes.items():
        setattr(u, field, value)

    db.commit()
    db.refresh(u)
    return {"message": "Đã cập nhật user", "user_id": user_id}


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    data:  ResetPasswordRequest,
    _:     dict    = Depends(require_super),
    db:    Session = Depends(get_db),
):
    """Đặt lại mật khẩu — trả về plaintext 1 lần duy nhất, không lưu."""
    u = db.query(User).filter(User.user_id == user_id).first()
    if not u:
        raise HTTPException(404, "Không tìm thấy user")

    # Nếu là super sentinel thì chặn
    if u.password_hash == "!SUPER_NO_BCRYPT!":
        raise HTTPException(400, "Tài khoản superadmin không thể reset qua đây")

    new_pass = data.new_password or "".join(
        random.choices(string.ascii_letters + string.digits, k=12)
    )
    u.password_hash = hash_password(new_pass)
    db.commit()
    return {
        "message":      "Đã đặt lại mật khẩu",
        "user_id":      user_id,
        "email":        u.email,
        "new_password": new_pass,
        "note":         "Lưu lại ngay — backend không lưu plaintext!",
    }


@router.delete("/{user_id}/hard")
def hard_delete_user(
    user_id: int,
    _:   dict    = Depends(require_super),
    db:  Session = Depends(get_db),
):
    """Xóa cứng user khỏi DB — không thể phục hồi."""
    u = db.query(User).filter(User.user_id == user_id).first()
    if not u:
        raise HTTPException(404, "Không tìm thấy user")
    db.delete(u)
    db.commit()
    return {"message": f"Đã xóa cứng user_id={user_id}"}
