from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

from app.database import get_db
from app.middleware.auth import get_current_user, require_shipper
from app.models.user import User
from app.models.shipment import Shipment, Shipper, ShipperBonus, ShipperTransaction, ShipperWithdrawal, ShipperIncident
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
    """Shipper xác nhận đã lấy hàng tại shop → Shipment in_transit, Order shipped."""
    from app.services.notification_service import create_notification
    shipment = pickup_order(db, shipment_id, current_user.user_id)

    # Notify khách hàng: đơn đang được giao
    from app.models.order import Order as _Order
    order = db.query(_Order).filter(_Order.order_id == shipment.order_id).first()
    if order:
        try:
            create_notification(
                db=db,
                user_id=order.user_id,
                title="🚚 Đơn hàng đang được giao",
                message=f"Shipper đã lấy đơn #{order.order_id} và đang trên đường giao đến bạn.",
                notif_type="order",
                related_entity_type="order",
                related_entity_id=order.order_id,
                action_url=f"/orders/{order.order_id}",
            )
        except Exception:
            pass

    return {"message": "Đã xác nhận lấy hàng — đang giao", "status": shipment.status}


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
            {
                "shipment_id":       s.shipment_id,
                "order_id":          s.order_id,
                "status":            s.status,
                "pickup_location":   s.pickup_location,
                "delivery_location": s.delivery_location,
                "failure_reason":    s.failure_reason,
                "created_at":        str(s.created_at),
                # Thông tin từ order
                "recipient":         s.order.recipient_name  if s.order else None,
                "phone":             s.order.recipient_phone if s.order else None,
                "amount":            float(s.order.final_price) if s.order and s.order.final_price else None,
                "payment_method":    s.order.payment_method  if s.order else None,
            }
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
        raise HTTPException(status_code=404, detail="Shipper not found")
    return {"rating": shipper.rating, "total_deliveries": shipper.total_deliveries}


# ── Bonuses ───────────────────────────────────────────────────────────────────

@router.get("/shipper/me/bonuses")
def my_bonuses(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    current_user: User = Depends(require_shipper),
    db: Session = Depends(get_db),
):
    q = db.query(ShipperBonus).filter(ShipperBonus.shipper_id == current_user.user_id)
    if status:
        q = q.filter(ShipperBonus.status == status)
    total = q.count()
    items = q.order_by(ShipperBonus.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    received_total = db.query(func.coalesce(func.sum(ShipperBonus.reward), 0)).filter(
        ShipperBonus.shipper_id == current_user.user_id,
        ShipperBonus.status == "received",
    ).scalar() or 0

    pending_total = db.query(func.coalesce(func.sum(ShipperBonus.reward), 0)).filter(
        ShipperBonus.shipper_id == current_user.user_id,
        ShipperBonus.status == "pending",
    ).scalar() or 0

    return {
        "bonuses": [
            {
                "bonus_id":    b.bonus_id,
                "type":        b.type,
                "title":       b.title,
                "reward":      float(b.reward),
                "period":      b.period,
                "status":      b.status,
                "received_at": str(b.received_at) if b.received_at else None,
                "created_at":  str(b.created_at),
            }
            for b in items
        ],
        "total":          total,
        "pages":          (total + limit - 1) // limit,
        "received_total": float(received_total),
        "pending_total":  float(pending_total),
    }


# ── Earnings / Finance ─────────────────────────────────────────────────────────

@router.get("/shipper/me/transactions")
def my_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    txn_type: Optional[str] = None,
    current_user: User = Depends(require_shipper),
    db: Session = Depends(get_db),
):
    q = db.query(ShipperTransaction).filter(ShipperTransaction.shipper_id == current_user.user_id)
    if txn_type:
        q = q.filter(ShipperTransaction.type == txn_type)
    total = q.count()
    items = q.order_by(ShipperTransaction.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "transactions": [
            {
                "txn_id":     t.txn_id,
                "order_id":   t.order_id,
                "type":       t.type,
                "amount":     float(t.amount),
                "status":     t.status,
                "note":       t.note,
                "created_at": str(t.created_at),
            }
            for t in items
        ],
        "total": total,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/shipper/me/earnings/monthly")
def my_monthly_earnings(
    months: int = Query(6, ge=1, le=12),
    current_user: User = Depends(require_shipper),
    db: Session = Depends(get_db),
):
    """Trả về doanh thu theo tháng (N tháng gần nhất)"""
    rows = (
        db.query(
            extract("year",  ShipperTransaction.created_at).label("year"),
            extract("month", ShipperTransaction.created_at).label("month"),
            func.sum(ShipperTransaction.amount).label("total"),
            func.count(ShipperTransaction.txn_id).label("count"),
        )
        .filter(
            ShipperTransaction.shipper_id == current_user.user_id,
            ShipperTransaction.status == "completed",
        )
        .group_by("year", "month")
        .order_by("year", "month")
        .all()
    )
    # Format thành danh sách tháng
    result = [
        {
            "month": f"{int(r.year)}-{int(r.month):02d}",
            "total": float(r.total),
            "count": int(r.count),
        }
        for r in rows
    ]
    return {"monthly": result[-months:]}


@router.get("/shipper/me/balance")
def my_balance(
    current_user: User = Depends(require_shipper),
    db: Session = Depends(get_db),
):
    earned = db.query(func.coalesce(func.sum(ShipperTransaction.amount), 0)).filter(
        ShipperTransaction.shipper_id == current_user.user_id,
        ShipperTransaction.status == "completed",
    ).scalar() or 0

    withdrawn = db.query(func.coalesce(func.sum(ShipperWithdrawal.amount), 0)).filter(
        ShipperWithdrawal.shipper_id == current_user.user_id,
        ShipperWithdrawal.status == "completed",
    ).scalar() or 0

    return {"balance": float(earned) - float(withdrawn), "total_earned": float(earned), "total_withdrawn": float(withdrawn)}


# ── Withdrawals ────────────────────────────────────────────────────────────────

class WithdrawalRequest(BaseModel):
    amount: float
    bank_name: str
    account_number: str
    account_holder: Optional[str] = None


@router.get("/shipper/me/withdrawals")
def my_withdrawals(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_shipper),
    db: Session = Depends(get_db),
):
    q = db.query(ShipperWithdrawal).filter(ShipperWithdrawal.shipper_id == current_user.user_id)
    total = q.count()
    items = q.order_by(ShipperWithdrawal.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "withdrawals": [
            {
                "wd_id":          w.wd_id,
                "amount":         float(w.amount),
                "bank_name":      w.bank_name,
                "account_number": w.account_number,
                "account_holder": w.account_holder,
                "status":         w.status,
                "note":           w.note,
                "created_at":     str(w.created_at),
                "completed_at":   str(w.completed_at) if w.completed_at else None,
            }
            for w in items
        ],
        "total": total,
        "pages": (total + limit - 1) // limit,
    }


@router.post("/shipper/me/withdrawals")
def create_withdrawal(
    data: WithdrawalRequest,
    current_user: User = Depends(require_shipper),
    db: Session = Depends(get_db),
):
    # Kiểm tra số dư
    earned = db.query(func.coalesce(func.sum(ShipperTransaction.amount), 0)).filter(
        ShipperTransaction.shipper_id == current_user.user_id,
        ShipperTransaction.status == "completed",
    ).scalar() or 0
    withdrawn = db.query(func.coalesce(func.sum(ShipperWithdrawal.amount), 0)).filter(
        ShipperWithdrawal.shipper_id == current_user.user_id,
        ShipperWithdrawal.status == "completed",
    ).scalar() or 0
    balance = float(earned) - float(withdrawn)

    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Số tiền không hợp lệ")
    if data.amount > balance:
        raise HTTPException(status_code=400, detail="Số dư không đủ")

    wd = ShipperWithdrawal(
        shipper_id=current_user.user_id,
        amount=data.amount,
        bank_name=data.bank_name,
        account_number=data.account_number,
        account_holder=data.account_holder,
        status="pending",
    )
    db.add(wd)
    db.commit()
    db.refresh(wd)
    return {"message": "Yêu cầu rút tiền đã được tạo", "wd_id": wd.wd_id, "status": wd.status}


# ── Incidents ─────────────────────────────────────────────────────────────────

class IncidentRequest(BaseModel):
    order_id: Optional[int] = None
    type: str
    title: str
    description: Optional[str] = None
    is_violation: bool = False


@router.get("/shipper/me/incidents")
def my_incidents(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    is_violation: Optional[bool] = None,
    current_user: User = Depends(require_shipper),
    db: Session = Depends(get_db),
):
    q = db.query(ShipperIncident).filter(ShipperIncident.shipper_id == current_user.user_id)
    if is_violation is not None:
        q = q.filter(ShipperIncident.is_violation == is_violation)
    total = q.count()
    items = q.order_by(ShipperIncident.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "incidents": [
            {
                "incident_id":  i.incident_id,
                "order_id":     i.order_id,
                "type":         i.type,
                "title":        i.title,
                "description":  i.description,
                "status":       i.status,
                "is_violation": i.is_violation,
                "support_note": i.support_note,
                "created_at":   str(i.created_at),
            }
            for i in items
        ],
        "total": total,
        "pages": (total + limit - 1) // limit,
    }


@router.post("/shipper/me/incidents")
def create_incident(
    data: IncidentRequest,
    current_user: User = Depends(require_shipper),
    db: Session = Depends(get_db),
):
    inc = ShipperIncident(
        shipper_id=current_user.user_id,
        order_id=data.order_id,
        type=data.type,
        title=data.title,
        description=data.description,
        is_violation=data.is_violation,
        status="open",
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)
    return {"message": "Báo cáo đã được ghi nhận", "incident_id": inc.incident_id}
