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


# "Nhân viên nội bộ" (employment) — quản lý kho các cấp, do admin tạo, không
# phải khách hàng: không được mua/bán hàng, chỉ thấy phần được cấp quyền.
# "Admin_emp" = cấp "Quản lý tổng" (trước đây gọi "warehouse_manager") — do
# admin tạo trực tiếp, có quyền CRUD tài khoản kho cấp dưới (hub/district/ward).
EMPLOYMENT_ROLES = {
    "Admin_emp", "warehouse_hub_manager",
    "warehouse_district_manager", "warehouse_ward_manager",
}


def forbid_employment(current_user: User = Depends(get_current_user)) -> User:
    """Chặn tài khoản nhân viên nội bộ (Admin_emp/quản lý kho các cấp) mua
    hoặc tự đăng ký bán hàng — các role này chỉ vận hành nghiệp vụ được admin
    giao, không đóng vai khách hàng của sàn."""
    user_roles = {ur.role.role_name for ur in current_user.user_roles if ur.status == "active"}
    if user_roles & EMPLOYMENT_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản nhân viên nội bộ không có quyền mua/bán hàng trên sàn",
        )
    return current_user


def require_warehouse_manager(current_user: User = Depends(get_current_user)) -> User:
    """Quản lý kho bất kỳ cấp nào (hoặc admin)."""
    user_roles = {ur.role.role_name for ur in current_user.user_roles if ur.status == "active"}
    allowed = EMPLOYMENT_ROLES | {"admin"}
    if not user_roles & allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Warehouse manager access required")
    return current_user


def require_hub_manager(current_user: User = Depends(get_current_user)) -> User:
    """Quản lý kho cấp 1 (city hub) hoặc admin."""
    user_roles = {ur.role.role_name for ur in current_user.user_roles if ur.status == "active"}
    if "warehouse_hub_manager" not in user_roles and "admin" not in user_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hub manager access required")
    return current_user


def require_district_manager(current_user: User = Depends(get_current_user)) -> User:
    """Quản lý kho cấp 2 (quận/huyện) hoặc admin."""
    user_roles = {ur.role.role_name for ur in current_user.user_roles if ur.status == "active"}
    if "warehouse_district_manager" not in user_roles and "admin" not in user_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="District manager access required")
    return current_user


def require_ward_manager(current_user: User = Depends(get_current_user)) -> User:
    """Quản lý kho cấp 3 (phường/xã) hoặc admin."""
    user_roles = {ur.role.role_name for ur in current_user.user_roles if ur.status == "active"}
    if "warehouse_ward_manager" not in user_roles and "admin" not in user_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Ward manager access required")
    return current_user
