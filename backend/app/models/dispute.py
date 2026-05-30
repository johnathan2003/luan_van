from sqlalchemy import Column, Integer, Text, Enum, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Dispute(Base):
    __tablename__ = "disputes"

    dispute_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id"), nullable=False)
    initiated_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    initiated_party = Column(Enum("user", "shop", "shipper"))
    reason = Column(Text)
    evidence_urls = Column(Text)
    status = Column(Enum("open", "resolved", "escalated"), default="open", index=True)
    resolved_by = Column(Integer, ForeignKey("users.user_id"))
    resolution_details = Column(Text)
    refund_amount = Column(String(15))
    created_at = Column(DateTime, server_default=func.now())
    resolved_at = Column(DateTime)

    __table_args__ = (
        Index("idx_dispute_status", "status"),
    )

    # Relationships
    order = relationship("Order", back_populates="disputes")
    initiator = relationship("User", foreign_keys=[initiated_by])
    resolver = relationship("User", foreign_keys=[resolved_by])
