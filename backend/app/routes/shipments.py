from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.middleware.auth import get_current_user, require_shipper
from app.models.user import User
from app.models.shipment import Shipment, Shipper
from app.schemas.shipment import LocationUpdate, ShipperStatusUpdate, ShipmentRejectRequest
from app.services.shipment_service import (
    get_available_shippers, assign_shipper_to_order, pickup_order,
    update_location, mark_delivered, reject_delivery, update_shipper_status,
    get_shipper_deliveries,
)

router = APIRouter()


@router.get("/available")
def available_shippers(db: Session = Depends(get_db)):
    shippers = get_available_shippers(db)
    return {
        "shippers": [
            {"shipper_id": s.shipper_id, "vehicle_type": s.vehicle_type, "rating": s.rating, "status": s.status}
            for s in shippers
        ]
    }


@router.get("/{shipment_id}")
def get_shipment(shipment_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not shipment:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Shipment not found")
    return {
        "shipment_id": shipment.shipment_id,
        "order_id": shipment.order_id,
        "shipper_id": shipment.shipper_id,
        "status": shipment.status,
        "current_location": shipment.current_location,
        "pickup_time": str(shipment.pickup_time) if shipment.pickup_time else None,
        "delivery_time": str(shipment.delivery_time) if shipment.delivery_time else None,
    }


@router.post("/{shipment_id}/accept")
def accept_shipment(shipment_id: int, current_user: User = Depends(require_shipper), db: Session = Depends(get_db)):
    shipment = pickup_order(db, shipment_id, current_user.user_id)
    return {"message": "Delivery accepted", "status": shipment.status}


@router.post("/{shipment_id}/reject")
def reject_shipment(
    shipment_id: int,
    data: ShipmentRejectRequest,
    current_user: User = Depends(require_shipper),
    db: Session = Depends(get_db),
):
    shipment = reject_delivery(db, shipment_id, current_user.user_id, data.reason)
    return {"message": "Delivery rejected", "status": shipment.status}


@router.post("/{shipment_id}/update-location")
def update_shipper_location(
    shipment_id: int,
    data: LocationUpdate,
    current_user: User = Depends(require_shipper),
    db: Session = Depends(get_db),
):
    location = update_location(db, shipment_id, current_user.user_id, data.lat, data.lng)
    return {"message": "Location updated", "location": location}


@router.post("/{shipment_id}/pickup")
def pickup(shipment_id: int, current_user: User = Depends(require_shipper), db: Session = Depends(get_db)):
    shipment = pickup_order(db, shipment_id, current_user.user_id)
    return {"message": "Order picked up", "status": shipment.status}


@router.post("/{shipment_id}/delivered")
def delivered(shipment_id: int, current_user: User = Depends(require_shipper), db: Session = Depends(get_db)):
    shipment = mark_delivered(db, shipment_id, current_user.user_id)
    return {"message": "Order delivered", "status": shipment.status}


@router.get("/shipper/me/deliveries")
def my_deliveries(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1),
    s_status: Optional[str] = None,
    current_user: User = Depends(require_shipper),
    db: Session = Depends(get_db),
):
    items, total, pages = get_shipper_deliveries(db, current_user.user_id, page, limit, s_status)
    return {
        "deliveries": [
            {"shipment_id": s.shipment_id, "order_id": s.order_id, "status": s.status, "created_at": str(s.created_at)}
            for s in items
        ],
        "total": total,
        "pages": pages,
    }


@router.put("/shipper/me/status")
def update_my_status(
    data: ShipperStatusUpdate,
    current_user: User = Depends(require_shipper),
    db: Session = Depends(get_db),
):
    shipper = update_shipper_status(db, current_user.user_id, data.status)
    return {"message": "Status updated", "status": shipper.status}


@router.get("/shipper/me/rating")
def my_rating(current_user: User = Depends(require_shipper), db: Session = Depends(get_db)):
    shipper = db.query(Shipper).filter(Shipper.shipper_id == current_user.user_id).first()
    if not shipper:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Shipper not found")
    return {"rating": shipper.rating, "total_deliveries": shipper.total_deliveries}
