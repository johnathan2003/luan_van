from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.shop import ShopEmployee, SystemEmployee
from app.middleware.auth import get_current_user


def check_employee_permission(user: User, shop_id: int, permission_code: str, db: Session) -> bool:
    """Check if a user (as shop employee) has a specific permission."""
    employee = db.query(ShopEmployee).filter(
        ShopEmployee.user_id == user.user_id,
        ShopEmployee.shop_id == shop_id,
        ShopEmployee.status == "active",
    ).first()

    if not employee:
        return False

    perms = {p.permission_code for p in employee.permissions}
    return permission_code in perms


def check_system_employee_permission(user: User, permission_code: str, db: Session) -> bool:
    """Check if a user (as system employee) has a specific permission."""
    emp = db.query(SystemEmployee).filter(
        SystemEmployee.user_id == user.user_id,
        SystemEmployee.status == "active",
    ).first()

    if not emp:
        return False

    perms = {p.permission_code for p in emp.permissions}
    return permission_code in perms


def require_permission(permission_code: str, shop_id_param: str = None):
    """Dependency factory: require a specific permission."""
    def _checker(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
        # Admin always passes
        user_roles = {ur.role.role_name for ur in current_user.user_roles if ur.status == "active"}
        if "admin" in user_roles:
            return current_user

        # Shop owner with their shop also passes
        if "shop" in user_roles:
            return current_user

        # System employee check
        if check_system_employee_permission(current_user, permission_code, db):
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: {permission_code}",
        )
    return _checker
