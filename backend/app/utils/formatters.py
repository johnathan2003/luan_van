from datetime import datetime
from typing import Optional


def format_datetime(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def format_currency(amount: float, currency: str = "VND") -> str:
    if currency == "VND":
        return f"{amount:,.0f}đ"
    return f"{amount:,.2f} {currency}"


def format_order_id(order_id: int) -> str:
    return f"ORD{order_id:08d}"


def format_phone(phone: str) -> str:
    phone = phone.replace("+84", "0").replace(" ", "")
    return phone


def truncate_text(text: str, max_length: int = 100) -> str:
    if len(text) <= max_length:
        return text
    return text[:max_length] + "..."
