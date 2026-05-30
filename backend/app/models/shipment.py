from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, JSON, Index
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
