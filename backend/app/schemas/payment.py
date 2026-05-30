from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MomoCreateRequest(BaseModel):
    order_id: int
    amount: int
    order_info: Optional[str] = None
    redirect_url: Optional[str] = None


class MomoCallbackQuery(BaseModel):
    partnerCode: str
    orderId: str
    requestId: str
    amount: int
    orderInfo: str
    orderType: str
    transId: int
    resultCode: int
    message: str
    payType: str
    responseTime: int
    extraData: str
    signature: str


class VNPayCreateRequest(BaseModel):
    order_id: int
    amount: int
    order_desc: Optional[str] = None
    bank_code: Optional[str] = None


class PaymentResponse(BaseModel):
    payment_id: int
    order_id: int
    trans_id: Optional[str]
    amount: str
    method: str
    status: str
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class CODCollectRequest(BaseModel):
    order_id: int
