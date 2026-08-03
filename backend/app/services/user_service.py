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
    # Kiểm tra thông tin cơ bản của user
    missing = []
    if not user.full_name or not user.full_name.strip():
        missing.append("họ và tên")
    if not user.phone or not user.phone.strip():
        missing.append("số điện thoại")
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vui lòng cập nhật thông tin cá nhân trước khi đăng ký shop: thiếu {', '.join(missing)}",
        )

    # Check if already a shop (query trực tiếp tránh lazy-load stale)
    from app.models.shop import Shop as ShopModel
    from app.models.user import UserRole, Role
    has_shop_entity = db.query(ShopModel).filter(ShopModel.shop_id == user.user_id).first()
    if has_shop_entity:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bạn đã có shop rồi")

    # Nếu có role "shop" nhưng không có Shop entity → stale role, tự dọn dẹp
    shop_role = db.query(Role).filter(Role.role_name == "shop").first()
    if shop_role:
        stale_role = db.query(UserRole).filter(
            UserRole.user_id == user.user_id,
            UserRole.role_id == shop_role.role_id,
        ).first()
        if stale_role:
            db.delete(stale_role)
            db.flush()

    # Tìm đơn đăng ký cũ bất kỳ trạng thái
    existing = db.query(ShopRegistration).filter(
        ShopRegistration.user_id == user.user_id,
    ).first()

    if existing:
        if existing.status == "approved":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Đơn đăng ký của bạn đã được phê duyệt trước đó")
        # pending hoặc rejected → cho phép cập nhật lại đơn
        existing.shop_name        = data.shop_name
        existing.description      = data.description
        existing.address          = data.address
        existing.product_images   = data.product_images
        existing.cmnd_url         = data.cmnd_url
        existing.cmnd_back_url    = data.cmnd_back_url
        existing.business_reg_url = data.business_reg_url
        existing.status           = "pending"
        existing.rejection_reason = None
        existing.reviewed_by      = None
        existing.reviewed_at      = None
        db.commit()
        db.refresh(existing)
        return existing

    reg = ShopRegistration(
        user_id=user.user_id,
        shop_name=data.shop_name,
        description=data.description,
        address=data.address,
        product_images=data.product_images,
        cmnd_url=data.cmnd_url,
        cmnd_back_url=data.cmnd_back_url,
        business_reg_url=data.business_reg_url,
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return reg


def register_as_shipper(db: Session, user: User, data: ShipperRegistrationCreate) -> ShipperRegistration:
    if user.shipper:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You are already a shipper")

    # Nếu đã có record (dù pending/rejected), UPDATE thay vì INSERT để tránh UniqueViolation
    existing = db.query(ShipperRegistration).filter(
        ShipperRegistration.user_id == user.user_id,
    ).first()

    if existing:
        if existing.status == "approved":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You are already a shipper")
        # Cập nhật lại đơn cũ (pending hoặc rejected)
        existing.vehicle_type     = data.vehicle_type
        existing.license_plate    = data.license_plate
        existing.shipper_type     = data.shipper_type
        existing.zone_province    = data.zone_province
        existing.zone_district    = data.zone_district
        existing.zone_ward        = data.zone_ward
        existing.license_url      = data.license_url
        existing.registration_url = data.registration_url
        existing.vehicle_photo_url = data.vehicle_photo_url
        existing.id_card_url      = data.id_card_url
        existing.status           = "pending"
        existing.rejection_reason = None
        existing.reviewed_by      = None
        existing.reviewed_at      = None
        db.commit()
        db.refresh(existing)
        return existing

    reg = ShipperRegistration(
        user_id=user.user_id,
        vehicle_type=data.vehicle_type,
        license_plate=data.license_plate,
        shipper_type=data.shipper_type,
        zone_province=data.zone_province,
        zone_district=data.zone_district,
        zone_ward=data.zone_ward,
        license_url=data.license_url,
        registration_url=data.registration_url,
        vehicle_photo_url=data.vehicle_photo_url,
        id_card_url=data.id_card_url,
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return reg


def deactivate_user(db: Session, user: User):
    user.status = "inactive"
    db.commit()
