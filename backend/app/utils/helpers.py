import math
from typing import TypeVar, Generic, List, Optional
from pydantic import BaseModel


def paginate(query, page: int = 1, limit: int = 20):
    """Apply pagination to a SQLAlchemy query."""
    total = query.count()
    pages = math.ceil(total / limit) if total > 0 else 0
    items = query.offset((page - 1) * limit).limit(limit).all()
    return items, total, pages


def format_price(value) -> str:
    """Convert numeric to string price."""
    if value is None:
        return "0.00"
    return f"{float(value):.2f}"


def parse_price(value) -> float:
    """Convert string price to float."""
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0.0


def build_response(data=None, message: str = "Success", status_code: int = 200):
    return {"message": message, "data": data, "status_code": status_code}


def get_current_role_name(user) -> Optional[str]:
    """Get the currently active role name for a user."""
    for user_role in user.user_roles:
        if user_role.current_role and user_role.status == "active":
            return user_role.role.role_name
    return None


def has_role(user, role_name: str) -> bool:
    """Check if user has a specific role (active)."""
    for user_role in user.user_roles:
        if user_role.role.role_name == role_name and user_role.status == "active":
            return True
    return False
