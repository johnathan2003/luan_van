from sqlalchemy import Column, Integer, String, Text, Enum, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Order(Base):
    __tablename__ = "orders"

    order_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    shop_id = Column(Integer, ForeignKey("users.user_id"))
    shipper_id = Column(Integer, ForeignKey("users.user_id"))
    total_price = Column(String(15), nullable=False)
    discount = Column(String(15), default="0.00")
    final_price = Column(String(15), nullable=False)
    payment_method = Column(Enum("momo", "cod", "vnpay"), default="cod")
    payment_status = Column(Enum("unpaid", "paid", "failed", "refunded"), default="unpaid")
    order_status = Column(
        Enum("pending", "confirmed", "ready_to_ship", "shipping", "delivered", "completed", "cancelled"),
        default="pending",
        index=True,
    )
    shipping_address = Column(Text, nullable=False)
    recipient_name = Column(String(255))
    recipient_phone = Column(String(20))
    note = Column(Text)
    voucher_code = Column(String(50))
    confirmed_by = Column(Integer, ForeignKey("users.user_id"))
    confirmed_at = Column(DateTime)
    prepared_by = Column(Integer, ForeignKey("users.user_id"))
    prepared_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_order_user", "user_id"),
        Index("idx_order_shop", "shop_id"),
        Index("idx_order_status", "order_status"),
        Index("idx_order_created", "created_at"),
    )

    # Relationships
    user = relationship("User", back_populates="orders", foreign_keys=[user_id])
    shop = relationship("Shop", foreign_keys=[shop_id])
    shipper_user = relationship("User", foreign_keys=[shipper_id])
    confirmer = relationship("User", foreign_keys=[confirmed_by])
    preparer = relationship("User", foreign_keys=[prepared_by])
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    payment = relationship("Payment", back_populates="order", uselist=False)
    shipment = relationship("Shipment", back_populates="order", uselist=False)
    disputes = relationship("Dispute", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    order_item_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    price_at_order = Column(String(15), nullable=False)
    product_name = Column(String(255))
    product_image = Column(String(500))
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_order_item_order", "order_id"),
    )

    # Relationships
    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")
