from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, JSON, Index, Numeric, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Shipper(Base):
    __tablename__ = "shippers"

    shipper_id = Column(Integer, ForeignKey("users.user_id"), primary_key=True)
    vehicle_type = Column(String(50))
    license_plate = Column(String(20))
    current_location = Column(JSON)
    status = Column(Enum("available", "on_delivery", "offline"), default="offline", index=True)
    rating = Column(String(5), default="0.00")
    total_deliveries = Column(Integer, default=0)
    verified_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="shipper", foreign_keys=[shipper_id])
    shipments = relationship("Shipment", back_populates="shipper")


class ShipperRegistration(Base):
    __tablename__ = "shipper_registrations"

    reg_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, unique=True)
    vehicle_type = Column(String(50))
    license_plate = Column(String(20))
    license_url = Column(String(500))
    registration_url = Column(String(500))
    id_card_url = Column(String(500))
    status = Column(Enum("pending", "approved", "rejected"), default="pending", index=True)
    rejection_reason = Column(String(500))
    reviewed_by = Column(Integer, ForeignKey("users.user_id"))
    reviewed_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])


class Shipment(Base):
    __tablename__ = "shipments"

    shipment_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id"), nullable=False)
    shipper_id = Column(Integer, ForeignKey("shippers.shipper_id"))
    pickup_location = Column(String(500))
    delivery_location = Column(String(500))
    status = Column(
        Enum("pending", "assigned", "picked_up", "in_transit", "delivered", "failed"),
        default="pending",
        index=True,
    )
    pickup_time = Column(DateTime)
    delivery_time = Column(DateTime)
    current_location = Column(JSON)
    route = Column(JSON)
    failure_reason = Column(String(500))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_shipment_shipper", "shipper_id"),
        Index("idx_shipment_status", "status"),
    )

    # Relationships
    order = relationship("Order", back_populates="shipment")
    shipper = relationship("Shipper", back_populates="shipments")


class ShipperBonus(Base):
    __tablename__ = "shipper_bonuses"

    bonus_id    = Column(Integer, primary_key=True, autoincrement=True)
    shipper_id  = Column(Integer, ForeignKey("shippers.shipper_id"), nullable=False, index=True)
    type        = Column(String(50), nullable=False)
    title       = Column(String(200), nullable=False)
    reward      = Column(Numeric(12, 2), nullable=False)
    period      = Column(String(100))
    status      = Column(Enum("received", "pending", "cancelled", name="shipper_bonus_status"), default="pending")
    received_at = Column(DateTime)
    created_at  = Column(DateTime, server_default=func.now())

    shipper = relationship("Shipper", foreign_keys=[shipper_id])


class ShipperTransaction(Base):
    __tablename__ = "shipper_transactions"

    txn_id      = Column(Integer, primary_key=True, autoincrement=True)
    shipper_id  = Column(Integer, ForeignKey("shippers.shipper_id"), nullable=False, index=True)
    order_id    = Column(Integer, ForeignKey("orders.order_id"), nullable=True)
    type        = Column(Enum("delivery_fee", "bonus", "adjustment", "refund"), nullable=False)
    amount      = Column(Numeric(12, 2), nullable=False)
    status      = Column(Enum("completed", "pending", "cancelled"), default="completed")
    note        = Column(String(300))
    created_at  = Column(DateTime, server_default=func.now())

    shipper = relationship("Shipper", foreign_keys=[shipper_id])


class ShipperWithdrawal(Base):
    __tablename__ = "shipper_withdrawals"

    wd_id          = Column(Integer, primary_key=True, autoincrement=True)
    shipper_id     = Column(Integer, ForeignKey("shippers.shipper_id"), nullable=False, index=True)
    amount         = Column(Numeric(12, 2), nullable=False)
    bank_name      = Column(String(100), nullable=False)
    account_number = Column(String(50), nullable=False)
    account_holder = Column(String(100))
    status         = Column(Enum("pending", "completed", "rejected"), default="pending")
    note           = Column(String(300))
    created_at     = Column(DateTime, server_default=func.now())
    completed_at   = Column(DateTime)

    shipper = relationship("Shipper", foreign_keys=[shipper_id])


class ShipperIncident(Base):
    __tablename__ = "shipper_incidents"

    incident_id  = Column(Integer, primary_key=True, autoincrement=True)
    shipper_id   = Column(Integer, ForeignKey("shippers.shipper_id"), nullable=False, index=True)
    order_id     = Column(Integer, ForeignKey("orders.order_id"), nullable=True)
    type         = Column(Enum("accident", "delay", "complaint", "lost_item", "other"), nullable=False)
    title        = Column(String(200), nullable=False)
    description  = Column(Text)
    status       = Column(Enum("open", "in_review", "resolved", "closed"), default="open")
    is_violation = Column(Boolean, default=False)
    support_note = Column(String(500))
    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())

    shipper = relationship("Shipper", foreign_keys=[shipper_id])
