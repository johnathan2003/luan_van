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


def _should_log(db: Session, admin_id: int) -> bool:
    """superadmin không bị ghi vào admin_logs — trả về False để bỏ qua."""
    has_superadmin = (
        db.query(UserRole)
        .join(Role)
        .filter(
            UserRole.user_id == admin_id,
            UserRole.status == "active",
            Role.role_name == "superadmin",
        )
        .first()
    )
    return has_superadmin is None  # True = cần log, False = superadmin → bỏ qua


def _log(
    db: Session,
    admin_id: int,
    action: str,
    target_type: str = None,
    target_id: int = None,
    details: dict = None,
):
    """Ghi AdminLog — tự động bỏ qua nếu admin_id là superadmin."""
    if _should_log(db, admin_id):
        db.add(AdminLog(
            admin_id=admin_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details,
        ))


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
    _log(db, admin_id, "user_banned", "user", user_id)
    db.commit()
    return user


def unban_user(db: Session, admin_id: int, user_id: int) -> User:
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "active"
    _log(db, admin_id, "user_unbanned", "user", user_id)
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

    # Đảm bảo user có role "user" (customer) — fix retroactive cho account cũ chưa có role
    user_role = db.query(Role).filter(Role.role_name == "user").first()
    if user_role:
        has_user_role = db.query(UserRole).filter(
            UserRole.user_id == reg.user_id, UserRole.role_id == user_role.role_id
        ).first()
        if not has_user_role:
            db.add(UserRole(user_id=reg.user_id, role_id=user_role.role_id, assigned_by=admin_id,
                            current_role=True, status="active"))

    # Thêm role "shop" — giữ nguyên role "user" (cả 2 tồn tại song song)
    shop_role = db.query(Role).filter(Role.role_name == "shop").first()
    if shop_role:
        existing = db.query(UserRole).filter(UserRole.user_id == reg.user_id, UserRole.role_id == shop_role.role_id).first()
        if not existing:
            db.add(UserRole(user_id=reg.user_id, role_id=shop_role.role_id, assigned_by=admin_id,
                            current_role=False, status="active"))

    _log(db, admin_id, "shop_approved", "shop_registration", reg_id)
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

    # Xóa role "shop" nếu có (stale role)
    shop_role = db.query(Role).filter(Role.role_name == "shop").first()
    if shop_role:
        stale = db.query(UserRole).filter(
            UserRole.user_id == reg.user_id,
            UserRole.role_id == shop_role.role_id,
        ).first()
        if stale:
            db.delete(stale)

    _log(db, admin_id, "shop_rejected", "shop_registration", reg_id)
    db.commit()
    create_notification(db, reg.user_id, "Shop bị từ chối", f"Đăng ký shop bị từ chối: {reason}", "shop_rejected")


def get_shipper_registrations(db: Session, page: int = 1, limit: int = 20, reg_status: str = "pending"):
    from sqlalchemy.orm import joinedload
    query = db.query(ShipperRegistration).options(joinedload(ShipperRegistration.user))
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

    # Đảm bảo user có role "user" trước khi thêm shipper
    user_role = db.query(Role).filter(Role.role_name == "user").first()
    if user_role:
        has_user_role = db.query(UserRole).filter(
            UserRole.user_id == reg.user_id, UserRole.role_id == user_role.role_id
        ).first()
        if not has_user_role:
            db.add(UserRole(user_id=reg.user_id, role_id=user_role.role_id, assigned_by=admin_id,
                            current_role=True, status="active"))

    shipper_role = db.query(Role).filter(Role.role_name == "shipper").first()
    if shipper_role:
        existing = db.query(UserRole).filter(UserRole.user_id == reg.user_id, UserRole.role_id == shipper_role.role_id).first()
        if not existing:
            db.add(UserRole(user_id=reg.user_id, role_id=shipper_role.role_id, assigned_by=admin_id,
                            current_role=False, status="active"))

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
    _log(db, admin_id, "dispute_resolved", "dispute", dispute_id)
    db.commit()


def get_admin_dashboard(db: Session) -> dict:
    from sqlalchemy import text

    def _count(tbl: str, where: str = "") -> int:
        try:
            sql = f"SELECT COUNT(*) FROM {tbl}" + (f" WHERE {where}" if where else "")
            return db.execute(text(sql)).scalar() or 0
        except Exception:
            db.rollback()
            return 0

    return {
        "total_users":                   _count("users"),
        "total_shops":                   _count("shops"),
        "total_orders":                  _count("orders"),
        "pending_shop_registrations":    _count("shop_registrations", "status = 'pending'"),
        "pending_shipper_registrations": _count("shipper_registrations", "status = 'pending'"),
        "open_disputes":                 _count("disputes", "status = 'open'"),
    }


# Checkbox "Quản lý kho" trong form phân quyền nhân viên = bundle của 3 quyền tạo
# tài khoản kho + role Admin_emp (đăng nhập được portal /warehouse). Role này
# trước đây tên "warehouse_manager" — đổi tên cho rõ nghĩa nhân viên nội bộ
# do admin tạo (xem middleware/auth.py::EMPLOYMENT_ROLES).
WAREHOUSE_MANAGE_PERM = "warehouse_manage"
WAREHOUSE_CREATE_PERMS = ["warehouse_create_hub", "warehouse_create_district", "warehouse_create_ward"]


def _sync_warehouse_manage(db: Session, emp: SystemEmployee, permissions: list, granted_by: int) -> None:
    """
    Đồng bộ quyền 'Tổng quản lý kho' khi checkbox warehouse_manage được bật/tắt:
    - Bật: gán role Admin_emp + 3 quyền warehouse_create_hub/district/ward
    - Tắt: thu hồi role + 3 quyền đó (giữ nguyên các quyền khác)
    """
    from app.models.user import Role, UserRole

    has_flag = WAREHOUSE_MANAGE_PERM in permissions

    role = db.query(Role).filter_by(role_name="Admin_emp").first()
    if has_flag and not role:
        role = Role(role_name="Admin_emp", description="BuyZo — Quản lý tổng kho (nhân viên nội bộ)")
        db.add(role)
        db.flush()

    if role:
        ur = db.query(UserRole).filter_by(user_id=emp.user_id, role_id=role.role_id).first()
        if has_flag:
            if ur:
                ur.status = "active"
            else:
                db.add(UserRole(
                    user_id=emp.user_id, role_id=role.role_id,
                    current_role=True, assigned_by=granted_by, status="active",
                ))
        elif ur:
            ur.status = "inactive"

    existing_codes = {p.permission_code for p in emp.permissions}
    if has_flag:
        for code in WAREHOUSE_CREATE_PERMS:
            if code not in existing_codes:
                db.add(SystemEmployeePermission(emp_id=emp.emp_id, permission_code=code, granted_by=granted_by))
    else:
        db.query(SystemEmployeePermission).filter(
            SystemEmployeePermission.emp_id == emp.emp_id,
            SystemEmployeePermission.permission_code.in_(WAREHOUSE_CREATE_PERMS),
        ).delete(synchronize_session=False)


def create_system_employee(db: Session, admin_id: int, employee_username: str, emp_name: str, role_name: str, permissions: list) -> SystemEmployee:
    """
    employee_username: tài khoản đăng nhập (do admin nhập) — email và mật khẩu
    được tự động sinh từ đây: email = {username}@buyzo.com, password = username.
    """
    username = employee_username.strip()
    if not username or len(username) < 6:
        raise HTTPException(400, "Tài khoản đăng nhập phải có ít nhất 6 ký tự")

    email = f"{username}@buyzo.com"
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            password_hash=hash_password(username),
            full_name=emp_name,
            status="active",
        )
        db.add(user)
        db.flush()
    else:
        # User đã tồn tại (VD: đã từng được thêm rồi "xoá" — soft-delete) —
        # kích hoạt lại tài khoản đăng nhập và đặt lại mật khẩu = username.
        user.status = "active"
        user.password_hash = hash_password(username)

    # Nếu user_id này ĐÃ TỪNG có bản ghi SystemEmployee (kể cả đã bị vô hiệu hoá
    # trước đó qua nút "Xoá") — tái sử dụng & kích hoạt lại bản ghi cũ thay vì
    # insert mới, vì system_employees.user_id có ràng buộc UNIQUE.
    emp = db.query(SystemEmployee).filter(SystemEmployee.user_id == user.user_id).first()
    if emp:
        emp.emp_name = emp_name
        emp.role_name = role_name
        emp.status = "active"
        emp.created_by = admin_id
        db.query(SystemEmployeePermission).filter(
            SystemEmployeePermission.emp_id == emp.emp_id
        ).delete(synchronize_session=False)
    else:
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
    db.flush()

    _sync_warehouse_manage(db, emp, permissions, admin_id)

    db.commit()
    db.refresh(emp)
    return emp
