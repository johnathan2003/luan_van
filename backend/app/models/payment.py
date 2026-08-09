from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, JSON, Index, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Payment(Base):
    __tablename__ = "payments"

    payment_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id"), nullable=False, unique=True)
    trans_id = Column(String(255))
    amount = Column(Numeric(10, 2), nullable=False)   # Prisma: Decimal(10,2)
    method = Column(Enum("momo", "cod", "vnpay", "zalopay", "credit_card", native_enum=False))
    # ZaloPay fields
    zalopay_app_trans_id = Column(String(64))
    zalopay_response = Column(JSON)
    # "expired" dùng cho luồng demo MoMo giả lập (hết 60s chưa xác nhận) —
    # cột DB là VARCHAR(50) thuần (không có CHECK constraint, xem migration
    # 202606010916_initial_schema.py) nên thêm giá trị mới không cần migration.
    status = Column(Enum("pending", "success", "failed", "expired", native_enum=False), default="pending", index=True)
    # Momo fields
    momo_request_id = Column(String(255))
    momo_response = Column(JSON)
    # VNPay fields
    vnpay_txn_ref = Column(String(100))
    vnpay_response = Column(JSON)
    # COD
    cod_collected_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_payment_status", "status"),
    )

    # Relationships
    order = relationship("Order", back_populates="payment")
