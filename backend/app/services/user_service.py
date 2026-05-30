from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User, Role, UserRole
from app.models.shop import Shop, ShopRegistration
from app.models.shipment import Shipper, ShipperRegistration
from app.schemas.user import UserUpdate, PasswordChange, ShopRegistrationCreate, ShipperRegistrationCreate
from app.utils.security import verify_password, hash_password
from app.utils.constants import RoleName


def get_user_by_id(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.user_id == user_id, User.status == "active").first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def update_user_profile(db: Session, user: User, data: UserUpdate) -> User:
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, data: PasswordChange):
    if not verify_password(data.old_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect current password")
    user.password_hash = hash_password(data.new_password)
    db.commit()


def switch_role(db: Session, user: User, new_role: str) -> User:
    # Validate the role exists and user has it
    valid_role = None
    for ur in user.user_roles:
        if ur.role.role_name == new_role and ur.status == "active":
            valid_role = ur
            break

    if not valid_role:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"You don't have role: {new_role}")

    # Reset all current_role to False, then set the chosen one
    for ur in user.user_roles:
        ur.current_role = False
    valid_role.current_role = True
    db.commit()
    db.refresh(user)
    return user


def get_user_roles(user: User) -> list:
    return [
        {"role_id": ur.role_id, "role_name": ur.role.role_name, "status": ur.status}
        for ur in user.user_roles
        if ur.status == "active"
    ]


def register_as_shop(db: Session, user: User, data: ShopRegistrationCreate) -> ShopRegistration:
    # Check existing pending
    existing = db.query(ShopRegistration).filter(
        ShopRegistration.user_id == user.user_id,
        ShopRegistration.status == "pending",
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You already have a pending shop registration")

    # Check if already a shop
    if user.shop:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You already own a shop")

    reg = ShopRegistration(
        user_id=user.user_id,
        shop_name=data.shop_name,
        description=data.description,
        address=data.address,
        cmnd_url=data.cmnd_url,
        cmnd_back_url=data.cmnd_back_url,
        business_reg_url=data.business_reg_url,
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return reg


def register_as_shipper(db: Session, user: User, data: ShipperRegistrationCreate) -> ShipperRegistration:
    existing = db.query(ShipperRegistration).filter(
        ShipperRegistration.user_id == user.user_id,
        ShipperRegistration.status == "pending",
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You already have a pending shipper registration")

    if user.shipper:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You are already a shipper")

    reg = ShipperRegistration(
        user_id=user.user_id,
        vehicle_type=data.vehicle_type,
        license_plate=data.license_plate,
        license_url=data.license_url,
        registration_url=data.registration_url,
        id_card_url=data.id_card_url,
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return reg


def deactivate_user(db: Session, user: User):
    user.status = "inactive"
    db.commit()
