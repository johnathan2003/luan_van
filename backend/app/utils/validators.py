import re
from typing import Optional


def validate_phone(phone: str) -> bool:
    pattern = r"^(\+84|0)[3|5|7|8|9][0-9]{8}$"
    return bool(re.match(pattern, phone))


def validate_email(email: str) -> bool:
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, email))


def validate_password(password: str) -> tuple[bool, Optional[str]]:
    if len(password) < 6:
        return False, "Password must be at least 6 characters"
    return True, None


def validate_image_url(url: str) -> bool:
    return url.startswith(("http://", "https://", "/uploads/"))


def sanitize_string(s: str) -> str:
    """Remove potentially dangerous characters."""
    return re.sub(r"[<>&\"']", "", s).strip()
