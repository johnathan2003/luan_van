from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class MessageOut(BaseModel):
    message_id: int
    conversation_id: int
    sender_id: int
    sender_role: str          # 'user' | 'shop'
    sender_name: Optional[str] = None
    sender_avatar: Optional[str] = None
    content: str
    image_url: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationOut(BaseModel):
    conversation_id: int
    user_id: int
    shop_id: int
    # thông tin partner (tùy context: user nhìn thấy shop, shop nhìn thấy user)
    partner_name:   Optional[str] = None
    partner_avatar: Optional[str] = None
    last_message:   Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count:   int = 0
    # assignment
    assigned_employee_id: Optional[int] = None
    assigned_employee_name: Optional[str] = None
    owner_notified: bool = False
    created_at:     datetime

    class Config:
        from_attributes = True


class SendMessageRequest(BaseModel):
    content: str
    image_url: Optional[str] = None


class ConversationListResponse(BaseModel):
    conversations: List[ConversationOut]
    total: int


class MessageListResponse(BaseModel):
    messages: List[MessageOut]
    total: int
    has_more: bool
