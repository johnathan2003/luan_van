from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.user import User, Role, UserRole
from app.models.shop import Shop, ShopRegistration, SystemEmployee, SystemEmployeePermission
from app.models.shipment import Shipper, ShipperRegistration
from app.models.product import ProductDeletionRequest, ProductDeletionAuditLog
from app.models.dispute import Dispute
from app.models.logs import AdminLog
from app.utils.helpers import paginate
from app.utils.security import hash_password
from app.services.notification_service import create_notification
import random
import string


def get_all_users(db: Session, page: int = 1, limit: int = 20, role: str = None, user_status: str = None):
    query = db.query(User)
    if user_status:
        query = query.filter(User.status == user_status)
    return paginate(query.order_by(User.created_at.desc()), page, limit)


def ban_user(db: Session, admin_id: int, user_id: int) -> User:
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "banned"
    db.add(AdminLog(admin_id=admin_id, action="user_banned", target_type="user", target_id=user_id))
    db.commit()
    return user


def unban_user(db: Session, admin_id: int, user_id: int) -> User:
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "active"
    db.add(AdminLog(admin_id=admin_id, action="user_unbanned", target_type="user", target_id=user_id))
    db.commit()
    return user


def get_shop_registrations(db: Session, page: int = 1, limit: int = 20, reg_status: str = "pending"):
    query = db.query(ShopRegistration)
    if reg_status:
        query = query.filter(ShopRegistration.status == reg_status)
    return paginate(query.order_by(ShopRegistration.created_at.desc()), page, limit)


def approve_shop_registration(db: Session, admin_id: int, reg_id: int) -> Shop:
    reg = db.query(ShopRegistration).filter(ShopRegistration.reg_id == reg_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    if reg.status != "pending":
        raise HTTPException(status_code=400, detail="Registration already reviewed")

    reg.status = "approved"
    reg.reviewed_by = admin_id
    reg.reviewed_at = datetime.utcnow()

    # Create shop
    shop = Shop(
        shop_id=reg.user_id,
        shop_name=reg.shop_name,
        description=reg.description,
        address=reg.address,
        verification_status="approved",
        verified_at=datetime.utcnow(),
    )
    db.add(shop)

    # Assign shop role
    shop_role = db.query(Role).filter(Role.role_name == "shop").first()
    if shop_role:
        existing = db.query(UserRole).filter(UserRole.user_id == reg.user_id, UserRole.role_id == shop_role.role_id).first()
        if not existing:
            db.add(UserRole(user_id=reg.user_id, role_id=shop_role.role_id, assigned_by=admin_id))

    db.add(AdminLog(admin_id=admin_id, action="shop_approved", target_type="shop_registration", target_id=reg_id))
    db.commit()
    db.refresh(shop)

    create_notification(db, reg.user_id, "Shop được duyệt", f"Shop '{reg.shop_name}' đã được phê duyệt!", "shop_approved", "shop", shop.shop_id)
    return shop


def reject_shop_registration(db: Session, admin_id: int, reg_id: int, reason: str):
    reg = db.query(ShopRegistration).filter(ShopRegistration.reg_id == reg_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")

    reg.status = "rejected"
    reg.rejection_reason = reason
    reg.reviewed_by = admin_id
    reg.reviewed_at = datetime.utcnow()

    db.add(AdminLog(admin_id=admin_id, action="shop_rejected", target_type="shop_registration", target_id=reg_id))
    db.commit()
    create_notification(db, reg.user_id, "Shop bị từ chối", f"Đăng ký shop bị từ chối: {reason}", "shop_rejected")


def get_shipper_registrations(db: Session, page: int = 1, limit: int = 20, reg_status: str = "pending"):
    query = db.query(ShipperRegistration)
    if reg_status:
        query = query.filter(ShipperRegistration.status == reg_status)
    return paginate(query.order_by(ShipperRegistration.created_at.desc()), page, limit)


def approve_shipper_registration(db: Session, admin_id: int, reg_id: int) -> Shipper:
    reg = db.query(ShipperRegistration).filter(ShipperRegistration.reg_id == reg_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")

    reg.status = "approved"
    reg.reviewed_by = admin_id
    reg.reviewed_at = datetime.utcnow()

    shipper = Shipper(
        shipper_id=reg.user_id,
        vehicle_type=reg.vehicle_type,
        license_plate=reg.license_plate,
        status="offline",
        verified_at=datetime.utcnow(),
    )
    db.add(shipper)

    shipper_role = db.query(Role).filter(Role.role_name == "shipper").first()
    if shipper_role:
        existing = db.query(UserRole).filter(UserRole.user_id == reg.user_id, UserRole.role_id == shipper_role.role_id).first()
        if not existing:
            db.add(UserRole(user_id=reg.user_id, role_id=shipper_role.role_id, assigned_by=admin_id))

    db.commit()
    db.refresh(shipper)
    create_notification(db, reg.user_id, "Đăng ký shipper thành công", "Bạn đã được chấp nhận làm shipper!", "shipper_approved")
    return shipper


def reject_shipper_registration(db: Session, admin_id: int, reg_id: int, reason: str):
    reg = db.query(ShipperRegistration).filter(ShipperRegistration.reg_id == reg_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    reg.status = "rejected"
    reg.rejection_reason = reason
    reg.reviewed_by = admin_id
    reg.reviewed_at = datetime.utcnow()
    db.commit()
    create_notification(db, reg.user_id, "Đăng ký shipper bị từ chối", f"Lý do: {reason}", "shipper_rejected")


def get_deletion_requests(db: Session, page: int = 1, limit: int = 20, req_status: str = "pending"):
    query = db.query(ProductDeletionRequest)
    if req_status:
        query = query.filter(ProductDeletionRequest.status == req_status)
    return paginate(query.order_by(ProductDeletionRequest.created_at.desc()), page, limit)


def resolve_dispute(db: Session, admin_id: int, dispute_id: int, decision: str, resolution_details: str):
    dispute = db.query(Dispute).filter(Dispute.dispute_id == dispute_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    dispute.status = "resolved"
    dispute.resolved_by = admin_id
    dispute.resolution_details = resolution_details
    dispute.resolved_at = datetime.utcnow()
    db.add(AdminLog(admin_id=admin_id, action="dispute_resolved", target_type="dispute", target_id=dispute_id))
    db.commit()


def get_admin_dashboard(db: Session) -> dict:
    from app.models.order import Order
    return {
        "total_users": db.query(User).count(),
        "total_shops": db.query(Shop).count(),
        "total_orders": db.query(Order).count(),
        "pending_shop_registrations": db.query(ShopRegistration).filter(ShopRegistration.status == "pending").count(),
        "pending_shipper_registrations": db.query(ShipperRegistration).filter(ShipperRegistration.status == "pending").count(),
        "open_disputes": db.query(Dispute).filter(Dispute.status == "open").count(),
    }


def create_system_employee(db: Session, admin_id: int, employee_email: str, emp_name: str, role_name: str, permissions: list) -> SystemEmployee:
    user = db.query(User).filter(User.email == employee_email).first()
    if not user:
        random_pass = "".join(random.choices(string.ascii_letters + string.digits, k=12))
        user = User(
            email=employee_email,
            password_hash=hash_password(random_pass),
            full_name=emp_name,
            status="active",
        )
        db.add(user)
        db.flush()

    emp = SystemEmployee(
        user_id=user.user_id,
        emp_name=emp_name,
        role_name=role_name,
        created_by=admin_id,
    )
    db.add(emp)
    db.flush()

    for perm in permissions:
        db.add(SystemEmployeePermission(emp_id=emp.emp_id, permission_code=perm, granted_by=admin_id))

    db.commit()
    db.refresh(emp)
    return emp
