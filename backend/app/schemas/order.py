from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


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
    price_at_order: Decimal  # Đổi từ str → Decimal (khớp Prisma)

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    order_id: int
    order_number: Optional[str]       # Prisma: orderNumber
    user_id: int
    shop_id: Optional[int]
    total_price: Decimal
    discount_amount: Optional[Decimal]  # Prisma: discountAmount
    final_price: Decimal
    shipping_fee: Optional[Decimal]   # Prisma: shippingFee (mới)
    payment_method: str
    payment_status: str
    order_status: str
    shipping_address: Optional[str]
    recipient_name: Optional[str]
    recipient_phone: Optional[str]
    notes: Optional[str]              # Prisma: notes
    voucher_id: Optional[int]
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
