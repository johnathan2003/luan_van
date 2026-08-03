from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.user import UserUpdate, PasswordChange, ShopRegistrationCreate, ShipperRegistrationCreate
from app.services.user_service import (
    get_user_by_id, update_user_profile, change_password,
    switch_role, get_user_roles, register_as_shop, register_as_shipper,
)
from app.utils.upload_service import save_upload_file

router = APIRouter()


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from sqlalchemy import text as _text
    from app.models.shop import Shop

    # Kiểm tra xem user có shop thực sự không
    has_shop = db.query(Shop).filter(Shop.shop_id == current_user.user_id).first() is not None

    roles = [
        {"role_id": ur.role_id, "role_name": ur.role.role_name, "status": ur.status}
        for ur in current_user.user_roles
        if ur.status == "active"
        # Lọc bỏ role 'shop' nếu shop đã bị xóa
        and not (ur.role.role_name == "shop" and not has_shop)
    ]

    current_role = next((ur.role.role_name for ur in current_user.user_roles if ur.current_role), None)
    # Nếu current_role là 'shop' nhưng shop không còn → fallback về 'user'
    if current_role == "shop" and not has_shop:
        current_role = next(
            (ur.role.role_name for ur in current_user.user_roles
             if ur.status == "active" and ur.role.role_name != "shop"),
            "user"
        )

    return {
        "user_id": current_user.user_id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "phone": current_user.phone,
        "address": current_user.address,
        "avatar_url": current_user.avatar_url,
        "status": current_user.status,
        "roles": roles,
        "current_role": current_role,
    }


@router.put("/me")
def update_me(data: UserUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = update_user_profile(db, current_user, data)
    return {"message": "Profile updated", "user_id": user.user_id}


@router.put("/me/password")
def update_password(data: PasswordChange, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    change_password(db, current_user, data)
    return {"message": "Password updated"}


@router.put("/me/current-role")
def update_current_role(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    role = data.get("role")
    user = switch_role(db, current_user, role)
    return {"message": "Role switched", "current_role": role}


@router.get("/me/roles")
def get_my_roles(current_user: User = Depends(get_current_user)):
    return {"roles": get_user_roles(current_user)}


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    url = await save_upload_file(file, "users")
    current_user.avatar_url = url
    db.commit()
    return {"message": "Avatar uploaded", "avatar_url": url}


@router.post("/me/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    url = await save_upload_file(file, "shop_registrations")
    return {"url": url}


@router.post("/register-shop", status_code=201)
def register_shop(
    data: ShopRegistrationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reg = register_as_shop(db, current_user, data)
    return {"message": "Shop registration submitted", "reg_id": reg.reg_id, "status": reg.status}


@router.get("/me/shop-registration")
def get_shop_registration(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.shop import ShopRegistration
    reg = db.query(ShopRegistration).filter(ShopRegistration.user_id == current_user.user_id).first()
    if not reg:
        return {"shop_reg": None}
    return {
        "shop_reg": {
            "reg_id": reg.reg_id,
            "shop_name": reg.shop_name,
            "status": reg.status,
            "rejection_reason": reg.rejection_reason,
            "created_at": str(reg.created_at),
        }
    }


@router.post("/register-shipper", status_code=201)
def register_shipper(
    data: ShipperRegistrationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reg = register_as_shipper(db, current_user, data)
    return {"message": "Shipper registration submitted", "reg_id": reg.reg_id}


@router.get("/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = get_user_by_id(db, user_id)
    return {
        "user_id": user.user_id,
        "full_name": user.full_name,
        "phone": user.phone,
        "avatar_url": user.avatar_url,
        "status": user.status,
    }
