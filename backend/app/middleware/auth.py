from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, UserRole, Role
from app.utils.security import decode_token

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_token(token)

    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(
        User.user_id == int(user_id),
        User.status.in_(["active", "banned"]),
    ).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db),
) -> User | None:
    if not credentials:
        return None
    try:
        return get_current_user(credentials, db)
    except HTTPException:
        return None


def require_role(*roles: str):
    def _checker(current_user: User = Depends(get_current_user)) -> User:
        user_roles = {ur.role.role_name for ur in current_user.user_roles if ur.status == "active"}
        if not any(role in user_roles for role in roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(roles)}",
            )
        return current_user
    return _checker


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Admin vận hành sàn — trong khuôn khổ hệ thống, có ghi log."""
    user_roles = {ur.role.role_name for ur in current_user.user_roles if ur.status == "active"}
    if "admin" not in user_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def require_superadmin(current_user: User = Depends(get_current_user)) -> User:
    """Superadmin can thiệp DB trực tiếp — ngoài khuôn khổ hệ thống, KHÔNG ghi log."""
    user_roles = {ur.role.role_name for ur in current_user.user_roles if ur.status == "active"}
    if "superadmin" not in user_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Superadmin access required")
    return current_user


def require_admin_or_superadmin(current_user: User = Depends(get_current_user)) -> User:
    """Cho phép cả admin lẫn superadmin — dùng cho các endpoint đọc/xem chung."""
    user_roles = {ur.role.role_name for ur in current_user.user_roles if ur.status == "active"}
    if "admin" not in user_roles and "superadmin" not in user_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin or Superadmin access required")
    return current_user


def require_shop_owner(current_user: User = Depends(get_current_user)) -> User:
    user_roles = {ur.role.role_name for ur in current_user.user_roles if ur.status == "active"}
    if "shop" not in user_roles and "admin" not in user_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Shop owner access required")
    return current_user


def require_shipper(current_user: User = Depends(get_current_user)) -> User:
    user_roles = {ur.role.role_name for ur in current_user.user_roles if ur.status == "active"}
    if "shipper" not in user_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Shipper access required")
    return current_user


# "Nhân viên nội bộ" (employment) — không phải khách hàng: không được mua/bán
# hàng, chỉ thấy phần được cấp quyền.
#   - "Admin_emp" = cấp "Quản lý tổng" (trước đây gọi "warehouse_manager") — do
#     admin tạo trực tiếp, có quyền CRUD tài khoản kho cấp dưới (hub/district/ward).
#   - "employee"  = nhân viên thường — dùng CHUNG cho cả nhân viên shop
#     (ShopEmployee, chỉ xem) lẫn nhân viên kho hub/district/ward do Admin_emp/
#     admin tạo (SystemEmployee, có quyền CRUD trong phạm vi được giao). 2 loại
#     này CÙNG role string nhưng khác bảng phụ (ShopEmployee vs SystemEmployee)
#     — xem _is_platform_employee() bên dưới để phân biệt khi cần biết chính
#     xác đây là nhân viên kho hay nhân viên shop.
EMPLOYMENT_ROLES = {"Admin_emp", "employee"}


def _is_platform_employee(user_id: int, db: Session) -> bool:
    """True nếu đây là nhân viên nội bộ do admin/Admin_emp tạo (SystemEmployee,
    quản lý kho hub/district/ward) — KHÔNG phải nhân viên của shop
    (ShopEmployee). Cả 2 loại đều mang role "employee" nên cần phân biệt qua
    bảng phụ khi gate các endpoint chỉ dành riêng cho nhân viên kho."""
    from app.models.shop import SystemEmployee
    return db.query(SystemEmployee).filter(
        SystemEmployee.user_id == user_id, SystemEmployee.status == "active",
    ).first() is not None


def _user_warehouse_tier(user_id: int, db: Session) -> int | None:
    """Tier kho (1=hub, 2=district, 3=ward) mà user này đang phụ trách, suy từ
    WarehouseManager → Warehouse.tier. KHÔNG dựa vào role string vì 3 cấp
    hub/district/ward giờ dùng chung 1 role "employee" (xem EMPLOYMENT_ROLES)."""
    from app.models.shipment import WarehouseManager, Warehouse
    wm = db.query(WarehouseManager).filter(WarehouseManager.manager_id == user_id).first()
    if not wm or not wm.warehouse_id:
        return None
    wh = db.query(Warehouse).filter(Warehouse.warehouse_id == wm.warehouse_id).first()
    return wh.tier if wh else None


def forbid_employment(current_user: User = Depends(get_current_user)) -> User:
    """Chặn tài khoản nhân viên nội bộ (Admin_emp/quản lý kho/nhân viên shop)
    mua hoặc tự đăng ký bán hàng — các role này chỉ vận hành nghiệp vụ được
    giao, không đóng vai khách hàng của sàn."""
    user_roles = {ur.role.role_name for ur in current_user.user_roles if ur.status == "active"}
    if user_roles & EMPLOYMENT_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản nhân viên nội bộ không có quyền mua/bán hàng trên sàn",
        )
    return current_user


def require_warehouse_manager(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db),
) -> User:
    """Quản lý kho bất kỳ cấp nào (Admin_emp hoặc employee gắn kho thật qua
    SystemEmployee) hoặc admin."""
    user_roles = {ur.role.role_name for ur in current_user.user_roles if ur.status == "active"}
    if "admin" in user_roles or "Admin_emp" in user_roles:
        return current_user
    if "employee" in user_roles and _is_platform_employee(current_user.user_id, db):
        return current_user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Warehouse manager access required")


def _require_tier(tier_num: int, label: str):
    def _checker(
        current_user: User = Depends(get_current_user), db: Session = Depends(get_db),
    ) -> User:
        user_roles = {ur.role.role_name for ur in current_user.user_roles if ur.status == "active"}
        if "admin" in user_roles:
            return current_user
        if (
            "employee" in user_roles
            and _is_platform_employee(current_user.user_id, db)
            and _user_warehouse_tier(current_user.user_id, db) == tier_num
        ):
            return current_user
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"{label} access required")
    return _checker


require_hub_manager      = _require_tier(1, "Hub manager")
require_district_manager = _require_tier(2, "District manager")
require_ward_manager     = _require_tier(3, "Ward manager")
