from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date


class ShopUpdate(BaseModel):
    shop_name: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None


class ShopResponse(BaseModel):
    shop_id: int
    shop_name: str
    description: Optional[str]
    avatar_url: Optional[str]
    address: str
    phone: Optional[str]
    rating: str
    total_followers: int
    total_orders: int
    verification_status: str
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class EmployeeCreate(BaseModel):
    employee_email: str
    employee_name: str
    position: Optional[str] = None
    permissions: List[str] = []
    hired_date: Optional[date] = None
    password: Optional[str] = None   # Nếu không đặt thì tự sinh ngẫu nhiên 12 ký tự


class EmployeePermissionUpdate(BaseModel):
    permissions: List[str]


class EmployeeResponse(BaseModel):
    employee_id: int
    user_id: int
    employee_name: Optional[str]
    position: Optional[str]
    status: str
    hired_date: Optional[date]
    permissions: List[str] = []
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class VoucherCreate(BaseModel):
    code: str
    discount_type: str = "percentage"
    discount_value: float
    min_order_value: Optional[float] = None
    max_discount: Optional[float] = None
    max_uses: Optional[int] = None
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None


class VoucherResponse(BaseModel):
    voucher_id: int
    code: str
    discount_type: str
    discount_value: str
    min_order_value: Optional[str]
    max_uses: Optional[int]
    current_uses: int
    status: str
    valid_from: Optional[datetime]
    valid_to: Optional[datetime]

    class Config:
        from_attributes = True


class VoucherPublicResponse(BaseModel):
    voucher_id: int
    code: str
    discount_type: str
    discount_value: str
    min_order_value: Optional[str]
    max_discount: Optional[str]
    max_uses: Optional[int]
    current_uses: int
    status: str
    valid_from: Optional[datetime]
    valid_to: Optional[datetime]
    source: str  # "platform" | "shop"
    shop_name: Optional[str] = None
    is_collected: bool = False

    class Config:
        from_attributes = True


class AnalyticsResponse(BaseModel):
    total_revenue: float
    total_orders: int
    total_products: int
    top_products: List[dict]
    daily_revenue: List[dict]
    order_status_counts: dict
