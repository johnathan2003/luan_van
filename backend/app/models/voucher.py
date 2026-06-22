from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, Index, Numeric, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Voucher(Base):
    __tablename__ = "vouchers"

    voucher_id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), unique=True, nullable=False)
    discount_type = Column(Enum("percentage", "fixed"), default="percentage")
    # Prisma: Decimal(10,2) — đổi từ String sang Numeric
    discount_value = Column(Numeric(10, 2), nullable=False)
    min_order_value = Column(Numeric(10, 2))
    max_discount = Column(Numeric(10, 2))
    max_uses = Column(Integer)
    current_uses = Column(Integer, default=0)
    status = Column(Enum("active", "inactive", "expired"), default="active", index=True)
    valid_from = Column(DateTime)
    valid_to = Column(DateTime)
    created_by = Column(Integer, ForeignKey("users.user_id"))
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_voucher_code", "code"),
        Index("idx_voucher_status", "status"),
    )

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    orders = relationship("Order", back_populates="voucher", foreign_keys="Order.voucher_id")
    collections = relationship("VoucherCollection", back_populates="voucher")


class VoucherCollection(Base):
    """Voucher mà user đã 'thu thập' (lưu vào ví voucher của riêng mình)."""
    __tablename__ = "voucher_collections"

    collection_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    voucher_id = Column(Integer, ForeignKey("vouchers.voucher_id", ondelete="CASCADE"), nullable=False)
    collected_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "voucher_id", name="uq_user_voucher_collection"),
        Index("idx_voucher_collection_user", "user_id"),
    )

    user = relationship("User", foreign_keys=[user_id])
    voucher = relationship("Voucher", back_populates="collections")
