from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int


class OrderCreate(BaseModel):
    items: List[OrderItemCreate]
    shipping_address: str
    recipient_name: Optional[str] = None
    recipient_phone: Optional[str] = None
    payment_method: str = "cod"
    voucher_code: Optional[str] = None
    note: Optional[str] = None


class OrderItemResponse(BaseModel):
    order_item_id: int
    product_id: int
    product_name: Optional[str]
    product_image: Optional[str]
    quantity: int
    price_at_order: str

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    order_id: int
    user_id: int
    shop_id: Optional[int]
    total_price: str
    discount: str
    final_price: str
    payment_method: str
    payment_status: str
    order_status: str
    shipping_address: str
    recipient_name: Optional[str]
    recipient_phone: Optional[str]
    note: Optional[str]
    created_at: Optional[datetime]
    items: List[OrderItemResponse] = []

    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    orders: List[OrderResponse]
    total: int
    page: int
    pages: int


class OrderStatusUpdate(BaseModel):
    reason: Optional[str] = None


class TrackingResponse(BaseModel):
    order_id: int
    order_status: str
    shipment: Optional[dict] = None
