from sqlalchemy import Column, Integer, String, Text, Enum, DateTime, ForeignKey, Index, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Order(Base):
    __tablename__ = "orders"

    order_id = Column(Integer, primary_key=True, autoincrement=True)
    # Prisma: orderNumber (unique string như "ORD-20240101-0001")
    order_number = Column(String(50), unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    shop_id = Column(Integer, ForeignKey("shops.shop_id"))
    shipper_id = Column(Integer, ForeignKey("users.user_id"))
    # Prisma: Decimal(10,2) — đổi từ String sang Numeric
    total_price = Column(Numeric(10, 2), nullable=False)
    discount_amount = Column(Numeric(10, 2), default=0)   # Prisma: discountAmount
    final_price = Column(Numeric(10, 2), nullable=False)
    shipping_fee = Column(Numeric(10, 2), default=0)       # Prisma: shippingFee (mới)
    # Prisma: PaymentMethod enum — thêm credit_card, bỏ vnpay (hoặc giữ cả)
    payment_method = Column(Enum("momo", "cod", "vnpay", "credit_card"), default="cod")
    payment_status = Column(Enum("unpaid", "paid", "failed", "refunded"), default="unpaid")
    # Prisma OrderStatus: PENDING,CONFIRMED,PAID,SHIPPED,DELIVERED,CANCELLED,RETURNED
    # Giữ thêm "ready_to_ship" và "completed" để tương thích workflow hiện tại
    order_status = Column(
        Enum(
            "pending", "confirmed", "paid", "ready_to_ship",
            "shipped", "delivered", "completed", "cancelled", "returned"
        ),
        default="pending",
        index=True,
    )
    shipping_address = Column(Text)
    recipient_name = Column(String(255))
    recipient_phone = Column(String(20))
    notes = Column(Text)                                    # Prisma: notes
    voucher_id = Column(Integer, ForeignKey("vouchers.voucher_id"))  # Prisma: FK trực tiếp
    voucher_code = Column(String(50))                       # Giữ lại để backward compat
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
    voucher = relationship("Voucher", foreign_keys=[voucher_id])
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    payment = relationship("Payment", back_populates="order", uselist=False)
    shipment = relationship("Shipment", back_populates="order", uselist=False)
    disputes = relationship("Dispute", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    order_item_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    price_at_order = Column(Numeric(10, 2), nullable=False)  # Prisma: Decimal(10,2)
    product_name = Column(String(255))   # snapshot tên sản phẩm lúc đặt
    product_image = Column(String(500))  # snapshot ảnh lúc đặt
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_order_item_order", "order_id"),
    )

    # Relationships
    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")
