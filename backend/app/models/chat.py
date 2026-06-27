from sqlalchemy import Column, Integer, Text, Boolean, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Conversation(Base):
    """Cuộc hội thoại giữa 1 user (buyer) và 1 shop."""
    __tablename__ = "conversations"

    conversation_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id  = Column(Integer, ForeignKey("users.user_id"),  nullable=False)
    shop_id  = Column(Integer, ForeignKey("shops.shop_id"),  nullable=False)
    # Tin nhắn cuối — cache để hiển thị danh sách hội thoại nhanh
    last_message     = Column(Text)
    last_message_at  = Column(DateTime)
    # Số tin chưa đọc phía shop / phía user
    unread_by_shop   = Column(Integer, default=0)
    unread_by_user   = Column(Integer, default=0)
    # Đã thông báo owner 1 lần chưa (không spam mỗi tin)
    owner_notified       = Column(Boolean, default=False, nullable=False)
    # Nhân viên đang phụ trách (null = chưa ai nhận)
    assigned_employee_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        # Mỗi cặp user‑shop chỉ có 1 conversation
        Index("uq_conv_user_shop", "user_id", "shop_id", unique=True),
        Index("idx_conv_user", "user_id"),
        Index("idx_conv_shop", "shop_id"),
        Index("idx_conv_last_msg", "last_message_at"),
    )

    # Relationships
    user              = relationship("User", foreign_keys=[user_id])
    shop              = relationship("Shop", foreign_keys=[shop_id])
    assigned_employee = relationship("User", foreign_keys=[assigned_employee_id])
    messages = relationship("Message", back_populates="conversation",
                            order_by="Message.created_at",
                            cascade="all, delete-orphan")


class Message(Base):
    """Tin nhắn trong một conversation."""
    __tablename__ = "messages"

    message_id      = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(Integer, ForeignKey("conversations.conversation_id",
                                                  ondelete="CASCADE"), nullable=False)
    sender_id       = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    # 'user' | 'shop'
    sender_role     = Column(String(10), nullable=False)
    content         = Column(Text, nullable=False)
    image_url       = Column(String(500))
    is_read         = Column(Boolean, default=False)
    read_at         = Column(DateTime)
    created_at      = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_msg_conv_created", "conversation_id", "created_at"),
        Index("idx_msg_sender",       "sender_id"),
    )

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender       = relationship("User", foreign_keys=[sender_id])
