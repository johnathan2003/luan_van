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
from app.models.wallet_auction import WarehouseTransfer, TransferPackage
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


# ── ADMIN: Hierarchy & Transfers ─────────────────────────────────────────────

@router.get("/hierarchy")
def warehouse_hierarchy(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Trả về cây kho 3 tầng:
      tier1 → [tier2] → [tier3]
    Kèm stats: số đơn đang ở mỗi kho.
    """
    all_warehouses = db.query(Warehouse).filter(Warehouse.is_active == True).all()

    def _fmt(w: Warehouse) -> dict:
        # Đếm đơn đang ở kho này
        at_count = db.query(Shipment).filter(
            Shipment.dest_warehouse_id == w.warehouse_id,
            Shipment.status.in_(["at_warehouse", "in_transit"]),
        ).count()
        mgr_name = None
        if w.manager:
            mgr_name = w.manager.full_name
        return {
            "warehouse_id":       w.warehouse_id,
            "name":               w.name,
            "tier":               getattr(w, "tier", 3),
            "province":           w.province,
            "address":            w.address,
            "district":           getattr(w, "district", None),
            "ward":               getattr(w, "ward", None),
            "parent_warehouse_id": getattr(w, "parent_warehouse_id", None),
            "manager_id":         getattr(w, "manager_id", None),
            "manager_name":       mgr_name,
            "is_active":          w.is_active,
            "shipments_count":    at_count,
            "children":           [],
        }

    nodes = {w.warehouse_id: _fmt(w) for w in all_warehouses}

    # Build tree
    roots = []
    for w in all_warehouses:
        pid = getattr(w, "parent_warehouse_id", None)
        if pid and pid in nodes:
            nodes[pid]["children"].append(nodes[w.warehouse_id])
        else:
            roots.append(nodes[w.warehouse_id])

    return {"warehouses": roots, "total": len(all_warehouses)}


# ── Transfers ─────────────────────────────────────────────────────────────────

def _fmt_transfer(t: WarehouseTransfer) -> dict:
    return {
        "transfer_id":        t.transfer_id,
        "from_warehouse_id":  t.from_warehouse_id,
        "from_warehouse":     t.from_warehouse.name if t.from_warehouse else None,
        "to_warehouse_id":    t.to_warehouse_id,
        "to_warehouse":       t.to_warehouse.name if t.to_warehouse else None,
        "transfer_type":      t.transfer_type,
        "status":             t.status,
        "note":               t.note,
        "created_by":         t.created_by,
        "created_at":         str(t.created_at),
        "departed_at":        str(t.departed_at) if t.departed_at else None,
        "arrived_at":         str(t.arrived_at) if t.arrived_at else None,
        "package_count":      len(t.packages),
    }


@router.get("/transfers")
def list_transfers(
    page:   int = Query(1, ge=1),
    limit:  int = Query(20, ge=1, le=100),
    status: str = Query(None),
    warehouse_id: int = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_warehouse_manager),
):
    """Quản lý kho xem danh sách transfer (lọc theo kho/status)."""
    query = db.query(WarehouseTransfer)
    if status:
        query = query.filter(WarehouseTransfer.status == status)
    if warehouse_id:
        query = query.filter(
            (WarehouseTransfer.from_warehouse_id == warehouse_id) |
            (WarehouseTransfer.to_warehouse_id == warehouse_id)
        )
    query = query.order_by(WarehouseTransfer.created_at.desc())
    items, total, pages = paginate(query, page, limit)
    return {"transfers": [_fmt_transfer(t) for t in items], "total": total, "pages": pages}


@router.post("/transfers")
def create_transfer(
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_warehouse_manager),
):
    """Tạo chuyến vận chuyển giữa kho."""
    from_id = body.get("from_warehouse_id")
    to_id   = body.get("to_warehouse_id")
    if not from_id or not to_id:
        raise HTTPException(status_code=400, detail="Cần from_warehouse_id và to_warehouse_id")
    if from_id == to_id:
        raise HTTPException(status_code=400, detail="Kho nguồn và đích không được trùng")

    transfer = WarehouseTransfer(
        from_warehouse_id=from_id,
        to_warehouse_id=to_id,
        transfer_type=body.get("transfer_type", "forward"),
        status="pending",
        note=body.get("note"),
        created_by=current_user.user_id,
    )
    db.add(transfer)
    db.flush()

    # Gán các shipment vào chuyến
    shipment_ids: list[int] = body.get("shipment_ids", [])
    for sid in shipment_ids:
        pkg = TransferPackage(transfer_id=transfer.transfer_id, shipment_id=sid)
        db.add(pkg)

    db.commit()
    db.refresh(transfer)
    return _fmt_transfer(transfer)


@router.put("/transfers/{transfer_id}/status")
def update_transfer_status(
    transfer_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_warehouse_manager),
):
    """Cập nhật trạng thái transfer: pending→in_transit→arrived→completed."""
    transfer = db.query(WarehouseTransfer).filter(WarehouseTransfer.transfer_id == transfer_id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")

    new_status = body.get("status")
    VALID_TRANSITIONS = {
        "pending":    ["in_transit", "cancelled"],
        "in_transit": ["arrived"],
        "arrived":    ["completed"],
    }
    if new_status not in VALID_TRANSITIONS.get(transfer.status, []):
        raise HTTPException(status_code=400, detail=f"Không thể chuyển từ {transfer.status} → {new_status}")

    from datetime import datetime
    transfer.status = new_status
    if new_status == "in_transit":
        transfer.departed_at = datetime.now()
    elif new_status == "arrived":
        transfer.arrived_at = datetime.now()
        # Cập nhật shipments: chuyển sang at_warehouse
        for pkg in transfer.packages:
            if pkg.shipment:
                pkg.shipment.status = "at_warehouse"
                pkg.shipment.shipper_id = None  # sẵn cho shipper khu vực lấy

    db.commit()
    return _fmt_transfer(transfer)


@router.get("/transfers/{transfer_id}")
def get_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_warehouse_manager),
):
    t = db.query(WarehouseTransfer).filter(WarehouseTransfer.transfer_id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    data = _fmt_transfer(t)
    data["shipments"] = [
        {
            "shipment_id": pkg.shipment_id,
            "order_id": pkg.shipment.order_id if pkg.shipment else None,
            "status": pkg.shipment.status if pkg.shipment else None,
            "delivery_location": pkg.shipment.delivery_location if pkg.shipment else None,
        }
        for pkg in t.packages
    ]
    return data


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
