from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.shipment import Shipment, Shipper
from app.models.order import Order
from app.utils.helpers import paginate
from app.websocket.handlers import notify_location_update, notify_order_shipping


def get_available_shippers(db: Session) -> list:
    return db.query(Shipper).filter(Shipper.status == "available").all()


def assign_shipper_to_order(db: Session, order_id: int, shipper_id: int) -> Shipment:
    shipment = db.query(Shipment).filter(Shipment.order_id == order_id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipper = db.query(Shipper).filter(Shipper.shipper_id == shipper_id, Shipper.status == "available").first()
    if not shipper:
        raise HTTPException(status_code=400, detail="Shipper not available")

    shipment.shipper_id = shipper_id
    shipment.status = "assigned"
    shipper.status = "on_delivery"

    order = db.query(Order).filter(Order.order_id == order_id).first()
    if order:
        order.shipper_id = shipper_id

    db.commit()
    db.refresh(shipment)
    return shipment


def accept_delivery(db: Session, shipment_id: int, shipper_id: int) -> Shipment:
    shipment = db.query(Shipment).filter(
        Shipment.shipment_id == shipment_id,
        Shipment.shipper_id == shipper_id,
    ).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if shipment.status != "assigned":
        raise HTTPException(status_code=400, detail="Shipment not in assignable status")
    shipment.status = "assigned"
    db.commit()
    return shipment


def pickup_order(db: Session, shipment_id: int, shipper_id: int) -> Shipment:
    shipment = db.query(Shipment).filter(
        Shipment.shipment_id == shipment_id,
        Shipment.shipper_id == shipper_id,
    ).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    # Shipper đã tới shop lấy hàng → shipment in_transit, order = shipped
    shipment.status = "in_transit"
    shipment.pickup_time = datetime.utcnow()

    order = db.query(Order).filter(Order.order_id == shipment.order_id).first()
    if order:
        order.order_status = "shipped"

    db.commit()
    return shipment


def update_location(db: Session, shipment_id: int, shipper_id: int, lat: float, lng: float):
    shipment = db.query(Shipment).filter(
        Shipment.shipment_id == shipment_id,
        Shipment.shipper_id == shipper_id,
    ).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    location = {"lat": lat, "lng": lng, "timestamp": datetime.utcnow().isoformat()}
    shipment.current_location = location
    db.commit()
    return location


def mark_delivered(db: Session, shipment_id: int, shipper_id: int) -> Shipment:
    shipment = db.query(Shipment).filter(
        Shipment.shipment_id == shipment_id,
        Shipment.shipper_id == shipper_id,
    ).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment.status = "delivered"
    shipment.delivery_time = datetime.utcnow()

    order = db.query(Order).filter(Order.order_id == shipment.order_id).first()
    if order:
        order.order_status = "delivered"

    shipper = db.query(Shipper).filter(Shipper.shipper_id == shipper_id).first()
    if shipper:
        shipper.status = "available"
        shipper.total_deliveries += 1

    db.commit()
    return shipment


def reject_delivery(db: Session, shipment_id: int, shipper_id: int, reason: str) -> Shipment:
    shipment = db.query(Shipment).filter(
        Shipment.shipment_id == shipment_id,
        Shipment.shipper_id == shipper_id,
    ).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment.shipper_id = None
    shipment.status = "pending"
    shipment.failure_reason = reason

    shipper = db.query(Shipper).filter(Shipper.shipper_id == shipper_id).first()
    if shipper:
        shipper.status = "available"

    db.commit()
    return shipment


def update_shipper_status(db: Session, shipper_id: int, new_status: str) -> Shipper:
    shipper = db.query(Shipper).filter(Shipper.shipper_id == shipper_id).first()
    if not shipper:
        raise HTTPException(status_code=404, detail="Shipper not found")
    shipper.status = new_status
    db.commit()
    return shipper


def get_shipper_deliveries(db: Session, shipper_id: int, page: int = 1, limit: int = 10, s_status: str = None):
    query = db.query(Shipment).filter(Shipment.shipper_id == shipper_id)
    if s_status:
        query = query.filter(Shipment.status == s_status)
    query = query.order_by(Shipment.created_at.desc())
    return paginate(query, page, limit)
