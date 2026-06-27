from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, Numeric, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Banner(Base):
    __tablename__ = "banners"

    banner_id     = Column(Integer, primary_key=True, autoincrement=True)
    title         = Column(String(200), nullable=False)
    shop_id       = Column(Integer, ForeignKey("shops.shop_id"), nullable=True)
    shop_name     = Column(String(200))          # cache tên shop khi submit
    status        = Column(Enum("pending", "active", "rejected", name="banner_status"), default="pending", index=True)
    valid_from    = Column(String(20))
    valid_to      = Column(String(20))
    link          = Column(String(500))
    image_url     = Column(String(500))
    emoji         = Column(String(20))
    color1        = Column(String(20))
    color2        = Column(String(20))
    display_order = Column(Integer, default=0)
    created_at    = Column(DateTime, server_default=func.now())
    updated_at    = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Feedback(Base):
    __tablename__ = "feedbacks"

    feedback_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id     = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    user_name   = Column(String(100))
    user_email  = Column(String(200))
    subject     = Column(String(300), nullable=False)
    content     = Column(Text, nullable=False)
    type        = Column(Enum("bug", "complaint", "suggestion", "praise", "other", name="feedback_type"), default="other")
    status      = Column(Enum("open", "in_progress", "resolved", "closed", name="feedback_status"), default="open", index=True)
    admin_note  = Column(Text)
    created_at  = Column(DateTime, server_default=func.now())
    updated_at  = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ShippingZone(Base):
    __tablename__ = "shipping_zones"

    zone_id        = Column(Integer, primary_key=True, autoincrement=True)
    name           = Column(String(100), nullable=False)
    provinces      = Column(String(500))       # comma-separated list
    base_fee       = Column(Numeric(10, 0), default=0)
    per_kg         = Column(Numeric(10, 0), default=0)
    estimated_days = Column(String(20))
    is_active      = Column(Boolean, default=True)
    created_at     = Column(DateTime, server_default=func.now())
    updated_at     = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ShippingMethod(Base):
    __tablename__ = "shipping_methods"

    method_id   = Column(Integer, primary_key=True, autoincrement=True)
    name        = Column(String(100), nullable=False)
    code        = Column(String(50), unique=True, nullable=False)
    description = Column(String(300))
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime, server_default=func.now())
    updated_at  = Column(DateTime, server_default=func.now(), onupdate=func.now())


class PlatformTransaction(Base):
    __tablename__ = "platform_transactions"

    txn_id     = Column(Integer, primary_key=True, autoincrement=True)
    type       = Column(Enum("commission", "refund", "payout", "adjustment", name="platform_txn_type"), nullable=False)
    amount     = Column(Numeric(14, 2), nullable=False)
    shop_id    = Column(Integer, ForeignKey("shops.shop_id"), nullable=True)
    shop_name  = Column(String(200))
    order_id   = Column(Integer, ForeignKey("orders.order_id"), nullable=True)
    status     = Column(Enum("completed", "pending", "cancelled", name="platform_txn_status"), default="completed")
    note       = Column(String(300))
    created_at = Column(DateTime, server_default=func.now())
