"""
Routes quản lý kho hàng.
- Admin: CRUD kho, gán quản lý kho
- Warehouse manager: xem tất cả đơn, xem đơn đến kho của mình
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user, require_admin_or_superadmin, require_warehouse_manager
from app.models.user import User
from app.models.shipment import Warehouse, WarehouseManager, Shipment, Shipper
from app.models.order import Order
from app.utils.helpers import paginate

router = APIRouter(prefix="/api/v1/warehouses", tags=["warehouses"])


# ── ADMIN: Quản lý kho ───────────────────────────────────────────────────────

@router.get("")
def list_warehouses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    warehouses = db.query(Warehouse).filter(Warehouse.is_active == True).order_by(Warehouse.province).all()
    return [
        {
            "warehouse_id": w.warehouse_id,
            "name": w.name,
            "province": w.province,
            "address": w.address,
            "lat": float(w.lat) if w.lat else None,
            "lng": float(w.lng) if w.lng else None,
            "is_active": w.is_active,
            "manager_count": len(w.managers),
        }
        for w in warehouses
    ]


@router.post("")
def create_warehouse(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_superadmin),
):
    w = Warehouse(
        name=data["name"],
        province=data["province"],
        address=data.get("address"),
        lat=data.get("lat"),
        lng=data.get("lng"),
    )
    db.add(w)
    db.commit()
    db.refresh(w)
    return {"warehouse_id": w.warehouse_id, "name": w.name, "province": w.province}


@router.put("/{warehouse_id}")
def update_warehouse(
    warehouse_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_superadmin),
):
    w = db.query(Warehouse).filter(Warehouse.warehouse_id == warehouse_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    for field in ("name", "province", "address", "lat", "lng", "is_active"):
        if field in data:
            setattr(w, field, data[field])
    db.commit()
    return {"message": "Updated"}


@router.post("/{warehouse_id}/assign-manager")
def assign_manager(
    warehouse_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_superadmin),
):
    """Gán user_id làm quản lý kho (role warehouse_manager phải được gán riêng qua admin users)."""
    user_id = data["user_id"]
    existing = db.query(WarehouseManager).filter(WarehouseManager.manager_id == user_id).first()
    if existing:
        existing.warehouse_id = warehouse_id
    else:
        mgr = WarehouseManager(manager_id=user_id, warehouse_id=warehouse_id)
        db.add(mgr)
    db.commit()
    return {"message": "Manager assigned"}


# ── WAREHOUSE MANAGER: Xem đơn hàng ─────────────────────────────────────────

@router.get("/manager/dashboard")
def manager_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_warehouse_manager),
):
    """Thống kê nhanh cho quản lý kho."""
    mgr = db.query(WarehouseManager).filter(WarehouseManager.manager_id == current_user.user_id).first()
    warehouse = mgr.warehouse if mgr else None

    total = db.query(Shipment).count()
    pending = db.query(Shipment).filter(Shipment.status == "pending").count()
    in_transit = db.query(Shipment).filter(Shipment.status.in_(["in_transit", "out_for_delivery"])).count()
    at_warehouse = db.query(Shipment).filter(Shipment.status == "at_warehouse").count()
    delivered = db.query(Shipment).filter(Shipment.status == "delivered").count()
    failed = db.query(Shipment).filter(Shipment.status == "failed").count()

    # Đơn đang đến kho của manager này
    incoming_count = 0
    if warehouse:
        incoming_count = db.query(Shipment).filter(
            Shipment.dest_warehouse_id == warehouse.warehouse_id,
            Shipment.status.in_(["assigned", "in_transit"]),
        ).count()

    return {
        "warehouse": {"warehouse_id": warehouse.warehouse_id, "name": warehouse.name, "province": warehouse.province} if warehouse else None,
        "stats": {
            "total": total,
            "pending": pending,
            "in_transit": in_transit,
            "at_warehouse": at_warehouse,
            "delivered": delivered,
            "failed": failed,
            "incoming_to_my_warehouse": incoming_count,
        },
    }


@router.get("/manager/all-shipments")
def all_shipments(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    shipment_status: str = Query(None),
    shipment_type: str = Query(None),
    province: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_warehouse_manager),
):
    """Quản lý kho xem TẤT CẢ đơn hàng."""
    query = db.query(Shipment)
    if shipment_status:
        query = query.filter(Shipment.status == shipment_status)
    if shipment_type:
        query = query.filter(Shipment.shipment_type == shipment_type)
    query = query.order_by(Shipment.created_at.desc())
    items, total, pages = paginate(query, page, limit)

    return {
        "shipments": [_fmt_shipment(s) for s in items],
        "total": total,
        "pages": pages,
    }


@router.get("/manager/incoming")
def incoming_shipments(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_warehouse_manager),
):
    """Đơn liên tỉnh đang trên đường đến kho của manager này."""
    mgr = db.query(WarehouseManager).filter(WarehouseManager.manager_id == current_user.user_id).first()
    if not mgr or not mgr.warehouse_id:
        return {"shipments": [], "total": 0, "pages": 0}

    query = (
        db.query(Shipment)
        .filter(
            Shipment.dest_warehouse_id == mgr.warehouse_id,
            Shipment.status.in_(["assigned", "in_transit", "at_warehouse"]),
        )
        .order_by(Shipment.created_at.desc())
    )
    items, total, pages = paginate(query, page, limit)
    return {
        "shipments": [_fmt_shipment(s) for s in items],
        "total": total,
        "pages": pages,
    }


@router.post("/manager/shipments/{shipment_id}/mark-arrived")
def mark_arrived_at_warehouse(
    shipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_warehouse_manager),
):
    """Đánh dấu hàng đã đến kho — sẵn sàng cho shipper khu vực lấy."""
    s = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if s.status not in ("in_transit", "assigned"):
        raise HTTPException(status_code=400, detail="Shipment not in expected status")
    s.status = "at_warehouse"
    # Gỡ shipper liên tỉnh → sẵn sàng nhận bởi shipper khu vực
    s.shipper_id = None
    db.commit()
    return {"message": "Đã đánh dấu hàng đến kho", "status": s.status}


def _fmt_shipment(s: Shipment) -> dict:
    return {
        "shipment_id": s.shipment_id,
        "order_id": s.order_id,
        "shipment_type": s.shipment_type,
        "status": s.status,
        "pickup_location": s.pickup_location,
        "delivery_location": s.delivery_location,
        "src_warehouse": s.src_warehouse.name if s.src_warehouse else None,
        "dest_warehouse": s.dest_warehouse.name if s.dest_warehouse else None,
        "shipper_id": s.shipper_id,
        "shipper_name": s.shipper.user.full_name if s.shipper and s.shipper.user else None,
        "shipper_type": s.shipper.shipper_type if s.shipper else None,
        "created_at": str(s.created_at),
        "recipient": s.order.recipient_name if s.order else None,
        "phone": s.order.recipient_phone if s.order else None,
        "amount": float(s.order.final_price) if s.order and s.order.final_price else None,
    }
