"""
Routes quản lý kho hàng 3 cấp.
- tier 1: City hub (kho tổng)   → hub_manager / admin
- tier 2: District (kho quận)   → district_manager / hub_manager / admin
- tier 3: Ward (kho phường)     → ward_manager / district_manager / hub_manager / admin
- Shipper: thuộc kho cấp 3      → ward_manager quản lý
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import (
    get_current_user,
    require_admin_or_superadmin,
    require_warehouse_manager,
    require_hub_manager,
    require_district_manager,
    require_ward_manager,
)
from app.models.user import User
from app.models.shipment import (
    Warehouse, WarehouseManager, WarehouseShipper,
    Shipment, Shipper,
    InterProvincialBundle, BundleShipment, ShipmentLog,
)
from app.models.order import Order
from app.utils.helpers import paginate

router = APIRouter(prefix="/api/v1/warehouses", tags=["warehouses"])


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_manager_warehouse(user_id: int, db: Session) -> Warehouse | None:
    """Trả về kho mà user này đang quản lý (via warehouse_managers table)."""
    mgr = db.query(WarehouseManager).filter(WarehouseManager.manager_id == user_id).first()
    return mgr.warehouse if mgr else None


def _fmt_warehouse(w: Warehouse, include_stats: bool = False) -> dict:
    d: dict = {
        "warehouse_id":        w.warehouse_id,
        "name":                w.name,
        "province":            w.province,
        "city":                w.city,
        "district":            w.district,
        "ward":                w.ward,
        "ward_code":           w.ward_code,
        "tier":                w.tier,
        "parent_warehouse_id": w.parent_warehouse_id,
        "address":             w.address,
        "lat":                 float(w.lat) if w.lat else None,
        "lng":                 float(w.lng) if w.lng else None,
        "is_active":           w.is_active,
        "manager_count":       len(w.managers) if w.managers else 0,
    }
    return d


def _fmt_shipment(s: Shipment) -> dict:
    return {
        "shipment_id":       s.shipment_id,
        "order_id":          s.order_id,
        "shipment_type":     s.shipment_type,
        "status":            s.status,
        "pickup_location":   s.pickup_location,
        "delivery_location": s.delivery_location,
        "src_warehouse":     s.src_warehouse.name if s.src_warehouse else None,
        "dest_warehouse":    s.dest_warehouse.name if s.dest_warehouse else None,
        "shipper_id":        s.shipper_id,
        "shipper_name":      s.shipper.user.full_name if s.shipper and s.shipper.user else None,
        "shipper_type":      s.shipper.shipper_type if s.shipper else None,
        "created_at":        str(s.created_at),
        "recipient":         s.order.recipient_name if s.order else None,
        "phone":             s.order.recipient_phone if s.order else None,
        "amount":            float(s.order.final_price) if s.order and s.order.final_price else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN: CRUD kho, gán manager
# ─────────────────────────────────────────────────────────────────────────────

@router.get("")
def list_warehouses(
    tier: int = Query(None, ge=1, le=3),
    city: str = Query(None),
    parent_id: int = Query(None),
    is_active: bool = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy danh sách kho — có thể lọc theo tier, city, parent."""
    q = db.query(Warehouse)
    if tier is not None:
        q = q.filter(Warehouse.tier == tier)
    if city:
        q = q.filter(Warehouse.city == city)
    if parent_id is not None:
        q = q.filter(Warehouse.parent_warehouse_id == parent_id)
    if is_active is not None:
        q = q.filter(Warehouse.is_active == is_active)
    warehouses = q.order_by(Warehouse.province, Warehouse.name).all()
    return [_fmt_warehouse(w) for w in warehouses]


@router.get("/tree")
def warehouse_tree(
    city: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_warehouse_manager),
):
    """Cây kho: cấp 1 → cấp 2 → cấp 3 (lazy: chỉ trả về 2 cấp đầu)."""
    q1 = db.query(Warehouse).filter(Warehouse.tier == 1)
    if city:
        q1 = q1.filter(Warehouse.city == city)
    hubs = q1.all()

    result = []
    for hub in hubs:
        districts = db.query(Warehouse).filter(
            Warehouse.parent_warehouse_id == hub.warehouse_id,
            Warehouse.tier == 2,
        ).order_by(Warehouse.name).all()

        result.append({
            **_fmt_warehouse(hub),
            "children": [
                {
                    **_fmt_warehouse(d),
                    "ward_count": db.query(Warehouse).filter(
                        Warehouse.parent_warehouse_id == d.warehouse_id,
                        Warehouse.tier == 3,
                    ).count(),
                }
                for d in districts
            ],
        })
    return result


@router.get("/{warehouse_id}/children")
def warehouse_children(
    warehouse_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_warehouse_manager),
):
    """Kho con trực tiếp của warehouse_id."""
    parent = db.query(Warehouse).filter(Warehouse.warehouse_id == warehouse_id).first()
    if not parent:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    children = db.query(Warehouse).filter(
        Warehouse.parent_warehouse_id == warehouse_id,
    ).order_by(Warehouse.name).all()
    return [_fmt_warehouse(c) for c in children]


@router.get("/{warehouse_id}")
def get_warehouse(
    warehouse_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    w = db.query(Warehouse).filter(Warehouse.warehouse_id == warehouse_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    return _fmt_warehouse(w)


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
        tier=data.get("tier", 3),
        city=data.get("city"),
        district=data.get("district"),
        ward=data.get("ward"),
        ward_code=data.get("ward_code"),
        parent_warehouse_id=data.get("parent_warehouse_id"),
        is_active=data.get("is_active", True),
    )
    db.add(w)
    db.commit()
    db.refresh(w)
    return _fmt_warehouse(w)


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
    for field in ("name", "province", "address", "lat", "lng", "is_active",
                  "tier", "city", "district", "ward", "ward_code", "parent_warehouse_id"):
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
    """Gán user_id làm quản lý kho (admin only)."""
    user_id = data["user_id"]
    existing = db.query(WarehouseManager).filter(WarehouseManager.manager_id == user_id).first()
    if existing:
        existing.warehouse_id = warehouse_id
    else:
        mgr = WarehouseManager(manager_id=user_id, warehouse_id=warehouse_id)
        db.add(mgr)
    db.commit()
    return {"message": "Manager assigned"}


# ─────────────────────────────────────────────────────────────────────────────
# HUB MANAGER (cấp 1): xem kho quận + đơn liên tỉnh
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/hub/dashboard")
def hub_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hub_manager),
):
    """Dashboard cho quản lý kho tổng."""
    my_wh = _get_manager_warehouse(current_user.user_id, db)

    total_districts = 0
    active_districts = 0
    if my_wh:
        total_districts = db.query(Warehouse).filter(
            Warehouse.parent_warehouse_id == my_wh.warehouse_id, Warehouse.tier == 2,
        ).count()
        active_districts = db.query(Warehouse).filter(
            Warehouse.parent_warehouse_id == my_wh.warehouse_id,
            Warehouse.tier == 2, Warehouse.is_active == True,
        ).count()

    # Đơn liên tỉnh vào/ra
    incoming = db.query(Shipment).filter(
        Shipment.dest_warehouse_id == my_wh.warehouse_id if my_wh else False,
        Shipment.shipment_type == "inter_province",
        Shipment.status.in_(["assigned", "in_transit"]),
    ).count() if my_wh else 0

    outgoing_today = db.query(Shipment).filter(
        Shipment.src_warehouse_id == my_wh.warehouse_id if my_wh else False,
        Shipment.shipment_type == "inter_province",
    ).count() if my_wh else 0

    return {
        "warehouse": _fmt_warehouse(my_wh) if my_wh else None,
        "stats": {
            "total_districts": total_districts,
            "active_districts": active_districts,
            "incoming_inter_province": incoming,
            "outgoing_inter_province": outgoing_today,
        },
    }


@router.get("/hub/districts")
def hub_list_districts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hub_manager),
):
    """Danh sách kho cấp 2 thuộc hub của manager này."""
    my_wh = _get_manager_warehouse(current_user.user_id, db)
    if not my_wh:
        return {"districts": [], "hub": None}

    districts = db.query(Warehouse).filter(
        Warehouse.parent_warehouse_id == my_wh.warehouse_id,
        Warehouse.tier == 2,
    ).order_by(Warehouse.name).all()

    result = []
    for d in districts:
        mgr = db.query(WarehouseManager).filter(
            WarehouseManager.warehouse_id == d.warehouse_id
        ).first()
        ward_count = db.query(Warehouse).filter(
            Warehouse.parent_warehouse_id == d.warehouse_id, Warehouse.tier == 3,
        ).count()
        result.append({
            **_fmt_warehouse(d),
            "ward_count": ward_count,
            "manager_name": mgr.user.full_name if mgr and mgr.user else None,
            "manager_id": mgr.manager_id if mgr else None,
        })

    return {"hub": _fmt_warehouse(my_wh), "districts": result}


@router.post("/hub/districts/{district_id}/toggle-active")
def hub_toggle_district(
    district_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hub_manager),
):
    my_wh = _get_manager_warehouse(current_user.user_id, db)
    d = db.query(Warehouse).filter(
        Warehouse.warehouse_id == district_id,
        Warehouse.tier == 2,
        Warehouse.parent_warehouse_id == (my_wh.warehouse_id if my_wh else -1),
    ).first()
    if not d:
        raise HTTPException(status_code=404, detail="District warehouse not found in your scope")
    d.is_active = not d.is_active
    db.commit()
    return {"warehouse_id": d.warehouse_id, "is_active": d.is_active}


@router.get("/hub/shipments")
def hub_shipments(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    shipment_status: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hub_manager),
):
    """Đơn liên tỉnh đang qua kho tổng."""
    my_wh = _get_manager_warehouse(current_user.user_id, db)
    if not my_wh:
        return {"shipments": [], "total": 0, "pages": 0}
    q = db.query(Shipment).filter(
        (Shipment.src_warehouse_id == my_wh.warehouse_id) |
        (Shipment.dest_warehouse_id == my_wh.warehouse_id),
    )
    if shipment_status:
        q = q.filter(Shipment.status == shipment_status)
    q = q.order_by(Shipment.created_at.desc())
    items, total, pages = paginate(q, page, limit)
    return {"shipments": [_fmt_shipment(s) for s in items], "total": total, "pages": pages}


# ─────────────────────────────────────────────────────────────────────────────
# DISTRICT MANAGER (cấp 2): xem kho phường + chia lô xuống phường
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/district/dashboard")
def district_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_district_manager),
):
    """Dashboard cho quản lý kho quận."""
    my_wh = _get_manager_warehouse(current_user.user_id, db)

    total_wards = 0
    active_wards = 0
    if my_wh:
        total_wards = db.query(Warehouse).filter(
            Warehouse.parent_warehouse_id == my_wh.warehouse_id, Warehouse.tier == 3,
        ).count()
        active_wards = db.query(Warehouse).filter(
            Warehouse.parent_warehouse_id == my_wh.warehouse_id,
            Warehouse.tier == 3, Warehouse.is_active == True,
        ).count()

    pending_shipments = db.query(Shipment).filter(
        Shipment.dest_warehouse_id == my_wh.warehouse_id if my_wh else False,
        Shipment.status == "at_warehouse",
    ).count() if my_wh else 0

    return {
        "warehouse": _fmt_warehouse(my_wh) if my_wh else None,
        "stats": {
            "total_wards": total_wards,
            "active_wards": active_wards,
            "pending_dispatch": pending_shipments,
        },
    }


@router.get("/district/wards")
def district_list_wards(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_district_manager),
):
    """Danh sách kho cấp 3 thuộc quận của manager này."""
    my_wh = _get_manager_warehouse(current_user.user_id, db)
    if not my_wh:
        return {"wards": [], "district": None}

    wards = db.query(Warehouse).filter(
        Warehouse.parent_warehouse_id == my_wh.warehouse_id,
        Warehouse.tier == 3,
    ).order_by(Warehouse.ward).all()

    result = []
    for w in wards:
        mgr = db.query(WarehouseManager).filter(
            WarehouseManager.warehouse_id == w.warehouse_id
        ).first()
        shipper_count = db.query(WarehouseShipper).filter(
            WarehouseShipper.warehouse_id == w.warehouse_id,
            WarehouseShipper.status == "active",
        ).count()
        result.append({
            **_fmt_warehouse(w),
            "manager_name": mgr.user.full_name if mgr and mgr.user else None,
            "manager_id": mgr.manager_id if mgr else None,
            "shipper_count": shipper_count,
        })

    return {"district": _fmt_warehouse(my_wh), "wards": result}


@router.post("/district/wards")
def district_create_ward(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_district_manager),
):
    """Tạo kho cấp 3 mới trong quận của manager này."""
    my_wh = _get_manager_warehouse(current_user.user_id, db)
    if not my_wh:
        raise HTTPException(status_code=403, detail="Không có kho quản lý")
    w = Warehouse(
        name=data["name"],
        province=my_wh.province,
        city=my_wh.city,
        district=my_wh.district,
        ward=data.get("ward"),
        ward_code=data.get("ward_code"),
        tier=3,
        parent_warehouse_id=my_wh.warehouse_id,
        address=data.get("address"),
        is_active=data.get("is_active", True),
    )
    db.add(w)
    db.commit()
    db.refresh(w)
    return _fmt_warehouse(w)


@router.post("/district/wards/{ward_id}/toggle-active")
def district_toggle_ward(
    ward_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_district_manager),
):
    my_wh = _get_manager_warehouse(current_user.user_id, db)
    w = db.query(Warehouse).filter(
        Warehouse.warehouse_id == ward_id,
        Warehouse.tier == 3,
        Warehouse.parent_warehouse_id == (my_wh.warehouse_id if my_wh else -1),
    ).first()
    if not w:
        raise HTTPException(status_code=404, detail="Ward warehouse not found in your scope")
    w.is_active = not w.is_active
    db.commit()
    return {"warehouse_id": w.warehouse_id, "is_active": w.is_active}


@router.get("/district/shipments")
def district_shipments(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    shipment_status: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_district_manager),
):
    my_wh = _get_manager_warehouse(current_user.user_id, db)
    if not my_wh:
        return {"shipments": [], "total": 0, "pages": 0}
    q = db.query(Shipment).filter(
        (Shipment.src_warehouse_id == my_wh.warehouse_id) |
        (Shipment.dest_warehouse_id == my_wh.warehouse_id),
    )
    if shipment_status:
        q = q.filter(Shipment.status == shipment_status)
    q = q.order_by(Shipment.created_at.desc())
    items, total, pages = paginate(q, page, limit)
    return {"shipments": [_fmt_shipment(s) for s in items], "total": total, "pages": pages}


# ─────────────────────────────────────────────────────────────────────────────
# WARD MANAGER (cấp 3): quản lý shipper + đơn hàng phường
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/ward/dashboard")
def ward_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ward_manager),
):
    """Dashboard cho quản lý kho phường."""
    my_wh = _get_manager_warehouse(current_user.user_id, db)

    shipper_count = 0
    active_shippers = 0
    pending_orders = 0

    if my_wh:
        shipper_count = db.query(WarehouseShipper).filter(
            WarehouseShipper.warehouse_id == my_wh.warehouse_id,
        ).count()
        active_shippers = db.query(WarehouseShipper).filter(
            WarehouseShipper.warehouse_id == my_wh.warehouse_id,
            WarehouseShipper.status == "active",
        ).count()
        pending_orders = db.query(Shipment).filter(
            Shipment.dest_warehouse_id == my_wh.warehouse_id,
            Shipment.status.in_(["at_warehouse", "pending"]),
        ).count()

    return {
        "warehouse": _fmt_warehouse(my_wh) if my_wh else None,
        "stats": {
            "total_shippers": shipper_count,
            "active_shippers": active_shippers,
            "pending_orders": pending_orders,
        },
    }


@router.get("/ward/shippers")
def ward_list_shippers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ward_manager),
):
    """Danh sách shipper thuộc kho phường của manager này."""
    my_wh = _get_manager_warehouse(current_user.user_id, db)
    if not my_wh:
        return {"shippers": [], "warehouse": None}

    ws_list = db.query(WarehouseShipper).filter(
        WarehouseShipper.warehouse_id == my_wh.warehouse_id,
    ).all()

    result = []
    for ws in ws_list:
        s = ws.shipper
        result.append({
            "id":          ws.id,
            "shipper_id":  ws.shipper_id,
            "status":      ws.status,
            "assigned_at": str(ws.assigned_at),
            "full_name":   s.user.full_name if s and s.user else "Unknown",
            "phone":       s.user.phone if s and s.user else None,
            "vehicle_type":s.vehicle_type if s else None,
            "shipper_status": s.status if s else None,
            "total_deliveries": s.total_deliveries if s else 0,
            "rating":      s.rating if s else "0.00",
        })
    return {"warehouse": _fmt_warehouse(my_wh), "shippers": result}


@router.post("/ward/shippers")
def ward_add_shipper(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ward_manager),
):
    """Thêm shipper vào kho phường (gán kho phường cho shipper)."""
    my_wh = _get_manager_warehouse(current_user.user_id, db)
    if not my_wh or my_wh.tier != 3:
        raise HTTPException(status_code=403, detail="Chỉ kho cấp 3 mới có shipper")

    shipper_id = data["shipper_id"]
    shipper = db.query(Shipper).filter(Shipper.shipper_id == shipper_id).first()
    if not shipper:
        raise HTTPException(status_code=404, detail="Shipper không tồn tại")

    existing = db.query(WarehouseShipper).filter(
        WarehouseShipper.warehouse_id == my_wh.warehouse_id,
        WarehouseShipper.shipper_id == shipper_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Shipper đã thuộc kho này")

    ws = WarehouseShipper(
        warehouse_id=my_wh.warehouse_id,
        shipper_id=shipper_id,
        assigned_by=current_user.user_id,
        status="active",
    )
    db.add(ws)
    # Cập nhật home_warehouse_id trên shipper
    shipper.home_warehouse_id = my_wh.warehouse_id
    db.commit()
    return {"message": "Đã thêm shipper vào kho", "id": ws.id}


@router.delete("/ward/shippers/{shipper_id}")
def ward_remove_shipper(
    shipper_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ward_manager),
):
    """Xóa shipper khỏi kho phường."""
    my_wh = _get_manager_warehouse(current_user.user_id, db)
    if not my_wh:
        raise HTTPException(status_code=403, detail="Không có kho quản lý")
    ws = db.query(WarehouseShipper).filter(
        WarehouseShipper.warehouse_id == my_wh.warehouse_id,
        WarehouseShipper.shipper_id == shipper_id,
    ).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Shipper không thuộc kho này")
    db.delete(ws)
    db.commit()
    return {"message": "Đã xóa shipper khỏi kho"}


@router.patch("/ward/shippers/{shipper_id}/status")
def ward_update_shipper_status(
    shipper_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ward_manager),
):
    """Cập nhật trạng thái shipper trong kho phường: active/off_duty/suspended."""
    my_wh = _get_manager_warehouse(current_user.user_id, db)
    if not my_wh:
        raise HTTPException(status_code=403, detail="Không có kho quản lý")
    ws = db.query(WarehouseShipper).filter(
        WarehouseShipper.warehouse_id == my_wh.warehouse_id,
        WarehouseShipper.shipper_id == shipper_id,
    ).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Shipper không thuộc kho này")
    new_status = data.get("status")
    if new_status not in ("active", "off_duty", "suspended"):
        raise HTTPException(status_code=400, detail="Trạng thái không hợp lệ")
    ws.status = new_status
    db.commit()
    return {"message": "Đã cập nhật trạng thái"}


@router.get("/ward/orders")
def ward_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    shipment_status: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ward_manager),
):
    """Đơn hàng cần giao trong phường của manager này."""
    my_wh = _get_manager_warehouse(current_user.user_id, db)
    if not my_wh:
        return {"shipments": [], "total": 0, "pages": 0}
    q = db.query(Shipment).filter(
        Shipment.dest_warehouse_id == my_wh.warehouse_id,
    )
    if shipment_status:
        q = q.filter(Shipment.status == shipment_status)
    q = q.order_by(Shipment.created_at.desc())
    items, total, pages = paginate(q, page, limit)
    return {"shipments": [_fmt_shipment(s) for s in items], "total": total, "pages": pages}


@router.post("/ward/orders/{shipment_id}/assign-shipper")
def ward_assign_shipper(
    shipment_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_ward_manager),
):
    """Ward manager gán shipper cho đơn hàng đang ở kho phường."""
    my_wh = _get_manager_warehouse(current_user.user_id, db)
    s = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment không tồn tại")
    if my_wh and s.dest_warehouse_id != my_wh.warehouse_id:
        raise HTTPException(status_code=403, detail="Đơn này không thuộc kho của bạn")
    if s.status not in ("at_warehouse", "pending"):
        raise HTTPException(status_code=400, detail=f"Không thể gán shipper khi đơn ở trạng thái {s.status}")

    shipper_id = data.get("shipper_id")
    # Kiểm tra shipper thuộc kho này
    ws = db.query(WarehouseShipper).filter(
        WarehouseShipper.warehouse_id == my_wh.warehouse_id if my_wh else False,
        WarehouseShipper.shipper_id == shipper_id,
        WarehouseShipper.status == "active",
    ).first()
    if not ws and my_wh:
        raise HTTPException(status_code=400, detail="Shipper không thuộc kho phường này hoặc không active")

    s.shipper_id = shipper_id
    s.status = "assigned"
    db.commit()
    return {"message": f"Đã gán shipper cho đơn #{shipment_id}"}


# ─────────────────────────────────────────────────────────────────────────────
# Giữ lại endpoints cũ tương thích với WarehouseManagerLayout hiện tại
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/manager/dashboard")
def manager_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_warehouse_manager),
):
    """Dashboard tổng hợp — dùng chung cho layout cũ."""
    mgr = db.query(WarehouseManager).filter(WarehouseManager.manager_id == current_user.user_id).first()
    warehouse = mgr.warehouse if mgr else None

    total      = db.query(Shipment).count()
    pending    = db.query(Shipment).filter(Shipment.status == "pending").count()
    in_transit = db.query(Shipment).filter(Shipment.status.in_(["in_transit", "out_for_delivery"])).count()
    at_wh      = db.query(Shipment).filter(Shipment.status == "at_warehouse").count()
    delivered  = db.query(Shipment).filter(Shipment.status == "delivered").count()
    failed     = db.query(Shipment).filter(Shipment.status == "failed").count()

    incoming_count = 0
    if warehouse:
        incoming_count = db.query(Shipment).filter(
            Shipment.dest_warehouse_id == warehouse.warehouse_id,
            Shipment.status.in_(["assigned", "in_transit"]),
        ).count()

    return {
        "warehouse": _fmt_warehouse(warehouse) if warehouse else None,
        "stats": {
            "total": total, "pending": pending, "in_transit": in_transit,
            "at_warehouse": at_wh, "delivered": delivered, "failed": failed,
            "incoming_to_my_warehouse": incoming_count,
        },
    }


@router.get("/manager/all-shipments")
def all_shipments(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    shipment_status: str = Query(None),
    shipment_type: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_warehouse_manager),
):
    q = db.query(Shipment)
    if shipment_status:
        q = q.filter(Shipment.status == shipment_status)
    if shipment_type:
        q = q.filter(Shipment.shipment_type == shipment_type)
    q = q.order_by(Shipment.created_at.desc())
    items, total, pages = paginate(q, page, limit)
    return {"shipments": [_fmt_shipment(s) for s in items], "total": total, "pages": pages}


@router.get("/manager/incoming")
def incoming_shipments(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_warehouse_manager),
):
    mgr = db.query(WarehouseManager).filter(WarehouseManager.manager_id == current_user.user_id).first()
    if not mgr or not mgr.warehouse_id:
        return {"shipments": [], "total": 0, "pages": 0}
    q = (
        db.query(Shipment)
        .filter(
            Shipment.dest_warehouse_id == mgr.warehouse_id,
            Shipment.status.in_(["assigned", "in_transit", "at_warehouse"]),
        )
        .order_by(Shipment.created_at.desc())
    )
    items, total, pages = paginate(q, page, limit)
    return {"shipments": [_fmt_shipment(s) for s in items], "total": total, "pages": pages}


@router.post("/manager/shipments/{shipment_id}/mark-arrived")
def mark_arrived_at_warehouse(
    shipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_warehouse_manager),
):
    s = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")
    if s.status not in ("in_transit", "assigned"):
        raise HTTPException(status_code=400, detail="Shipment not in expected status")
    s.status = "at_warehouse"
    s.shipper_id = None
    db.commit()
    return {"message": "Đã đánh dấu hàng đến kho", "status": s.status}


@router.get("/manager/zone-shippers")
def list_zone_shippers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_warehouse_manager),
):
    mgr = db.query(WarehouseManager).filter(WarehouseManager.manager_id == current_user.user_id).first()
    if not mgr or not mgr.warehouse_id:
        return {"shippers": []}
    warehouse = mgr.warehouse
    province = warehouse.province if warehouse else None

    q = db.query(Shipper).filter(Shipper.shipper_type == "zone")
    if province:
        q = q.filter(Shipper.zone_province == province)
    shippers = q.all()
    return {
        "shippers": [
            {
                "shipper_id": s.shipper_id,
                "full_name":  s.user.full_name if s.user else "Unknown",
                "phone":      s.user.phone if s.user else None,
                "status":     s.status,
            }
            for s in shippers
        ]
    }


@router.post("/manager/shipments/{shipment_id}/assign-shipper")
def assign_zone_shipper(
    shipment_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_warehouse_manager),
):
    s = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment không tồn tại")
    if s.status not in ("at_warehouse", "pending", "assigned"):
        raise HTTPException(status_code=400, detail=f"Không thể gán shipper khi đơn đang ở trạng thái {s.status}")
    shipper_id = data.get("shipper_id")
    if not shipper_id:
        raise HTTPException(status_code=400, detail="Thiếu shipper_id")
    shipper = db.query(Shipper).filter(Shipper.shipper_id == shipper_id).first()
    if not shipper:
        raise HTTPException(status_code=404, detail="Shipper không tồn tại")
    s.shipper_id = shipper.shipper_id
    s.status = "assigned"
    db.commit()
    return {"message": f"Đã gán shipper {shipper.user.full_name if shipper.user else shipper_id} cho đơn #{shipment_id}"}


# ═══════════════════════════════════════════════════════════════════════════════
# BUNDLE LIÊN TỈNH  (Hub Manager only)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/hub/bundles")
def list_bundles(
    status: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hub_manager),
):
    """Danh sách bundle liên tỉnh của kho tổng hiện tại."""
    hub_wh = _get_manager_warehouse(current_user.user_id, db)
    if not hub_wh:
        raise HTTPException(status_code=404, detail="Không tìm thấy kho tổng của bạn")

    q = db.query(InterProvincialBundle).filter(
        (InterProvincialBundle.src_hub_id == hub_wh.warehouse_id) |
        (InterProvincialBundle.dest_hub_id == hub_wh.warehouse_id)
    )
    if status:
        q = q.filter(InterProvincialBundle.status == status)

    total = q.count()
    items = q.order_by(InterProvincialBundle.created_at.desc()) \
             .offset((page - 1) * limit).limit(limit).all()

    def _fmt(b: InterProvincialBundle):
        return {
            "bundle_id":    b.bundle_id,
            "bundle_code":  b.bundle_code,
            "src_hub":      b.src_hub.name if b.src_hub else None,
            "dest_hub":     b.dest_hub.name if b.dest_hub else None,
            "status":       b.status,
            "total_shipments": b.total_shipments,
            "total_cod":    float(b.total_cod or 0),
            "sealed_at":    str(b.sealed_at) if b.sealed_at else None,
            "arrived_at":   str(b.arrived_at) if b.arrived_at else None,
            "created_at":   str(b.created_at),
        }

    return {"bundles": [_fmt(b) for b in items], "total": total, "pages": (total + limit - 1) // limit}


@router.post("/hub/bundles")
def create_bundle(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hub_manager),
):
    """Tạo mã bundle liên tỉnh mới (LT-YYYYMMDD-HN-HCM-xxxx)."""
    from datetime import datetime, timezone
    import random

    hub_wh = _get_manager_warehouse(current_user.user_id, db)
    if not hub_wh or hub_wh.tier != 1:
        raise HTTPException(status_code=400, detail="Chỉ kho tổng (tier=1) mới tạo được bundle liên tỉnh")

    dest_hub_id = data.get("dest_hub_id")
    if not dest_hub_id:
        raise HTTPException(status_code=400, detail="Thiếu dest_hub_id (kho tổng đích)")
    dest_hub = db.query(Warehouse).filter(Warehouse.warehouse_id == dest_hub_id, Warehouse.tier == 1).first()
    if not dest_hub:
        raise HTTPException(status_code=404, detail="Không tìm thấy kho tổng đích")

    # Sinh mã LT-YYYYMMDD-{SRC}-{DEST}-{4 số}
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    src_code  = (hub_wh.city or "XX").upper()[:5]
    dest_code = (dest_hub.city or "YY").upper()[:5]
    for _ in range(10):
        seq = str(random.randint(0, 9999)).zfill(4)
        code = f"LT-{today}-{src_code}-{dest_code}-{seq}"
        if not db.query(InterProvincialBundle).filter(InterProvincialBundle.bundle_code == code).first():
            break
    else:
        raise HTTPException(status_code=500, detail="Không thể sinh mã bundle")

    bundle = InterProvincialBundle(
        bundle_code=code,
        src_hub_id=hub_wh.warehouse_id,
        dest_hub_id=dest_hub_id,
        status="pending",
        created_by=current_user.user_id,
    )
    db.add(bundle)
    db.commit()
    db.refresh(bundle)
    return {"message": "Tạo bundle thành công", "bundle_id": bundle.bundle_id, "bundle_code": bundle.bundle_code}


@router.get("/hub/bundles/{bundle_id}")
def get_bundle_detail(
    bundle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hub_manager),
):
    bundle = db.query(InterProvincialBundle).filter(InterProvincialBundle.bundle_id == bundle_id).first()
    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle không tồn tại")

    shipments = []
    for link in bundle.shipments:
        s = link.shipment
        if not s:
            continue
        order = s.order
        shipments.append({
            "shipment_id":   s.shipment_id,
            "delivery_code": s.delivery_code,
            "status":        s.status,
            "order_id":      s.order_id,
            "recipient":     order.recipient_name if order else None,
            "delivery_addr": s.delivery_location,
            "cod_amount":    float(order.final_price) if order and order.payment_method == "cod" else 0,
        })

    return {
        "bundle_id":      bundle.bundle_id,
        "bundle_code":    bundle.bundle_code,
        "src_hub":        bundle.src_hub.name if bundle.src_hub else None,
        "dest_hub":       bundle.dest_hub.name if bundle.dest_hub else None,
        "status":         bundle.status,
        "total_shipments": bundle.total_shipments,
        "total_cod":      float(bundle.total_cod or 0),
        "sealed_at":      str(bundle.sealed_at) if bundle.sealed_at else None,
        "arrived_at":     str(bundle.arrived_at) if bundle.arrived_at else None,
        "created_at":     str(bundle.created_at),
        "shipments":      shipments,
    }


@router.post("/hub/bundles/{bundle_id}/add-shipment")
def add_shipment_to_bundle(
    bundle_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hub_manager),
):
    """Thêm đơn SD vào bundle (chỉ khi bundle còn ở trạng thái pending)."""
    bundle = db.query(InterProvincialBundle).filter(InterProvincialBundle.bundle_id == bundle_id).first()
    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle không tồn tại")
    if bundle.status != "pending":
        raise HTTPException(status_code=400, detail=f"Bundle đã {bundle.status}, không thể thêm đơn")

    delivery_code = data.get("delivery_code")
    shipment_id   = data.get("shipment_id")

    shipment = None
    if delivery_code:
        shipment = db.query(Shipment).filter(Shipment.delivery_code == delivery_code).first()
    elif shipment_id:
        shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()

    if not shipment:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    # Kiểm tra đã trong bundle khác chưa
    existing = db.query(BundleShipment).filter(BundleShipment.shipment_id == shipment.shipment_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Đơn này đã thuộc một bundle khác")

    link = BundleShipment(bundle_id=bundle_id, shipment_id=shipment.shipment_id)
    db.add(link)

    # Cập nhật tổng
    order = shipment.order
    bundle.total_shipments = (bundle.total_shipments or 0) + 1
    if order and order.payment_method == "cod" and order.payment_status != "paid":
        bundle.total_cod = (bundle.total_cod or 0) + (order.final_price or 0)

    db.commit()
    return {
        "message": f"Đã thêm đơn {shipment.delivery_code or shipment.shipment_id} vào bundle",
        "total_shipments": bundle.total_shipments,
    }


@router.post("/hub/bundles/{bundle_id}/seal")
def seal_bundle(
    bundle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hub_manager),
):
    """Niêm phong bundle → không thêm/bớt được nữa, cập nhật tất cả đơn SD → in_transit_interprovincial."""
    from datetime import datetime, timezone
    bundle = db.query(InterProvincialBundle).filter(InterProvincialBundle.bundle_id == bundle_id).first()
    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle không tồn tại")
    if bundle.status != "pending":
        raise HTTPException(status_code=400, detail=f"Bundle đang ở trạng thái {bundle.status}")
    if bundle.total_shipments == 0:
        raise HTTPException(status_code=400, detail="Bundle chưa có đơn hàng nào")

    bundle.status    = "in_transit"
    bundle.sealed_by = current_user.user_id
    bundle.sealed_at = datetime.now(timezone.utc)

    # Cập nhật tất cả đơn SD trong bundle
    for link in bundle.shipments:
        s = link.shipment
        if s:
            s.status = "in_transit_interprovincial"
            log = ShipmentLog(
                shipment_id=s.shipment_id,
                status="in_transit_interprovincial",
                warehouse_id=bundle.src_hub_id,
                note=f"Bundle {bundle.bundle_code} đã niêm phong, lên xe liên tỉnh",
                created_by=current_user.user_id,
            )
            db.add(log)

    db.commit()
    return {"message": f"Bundle {bundle.bundle_code} đã niêm phong và đang vận chuyển liên tỉnh"}


@router.post("/hub/bundles/{bundle_id}/confirm-arrival")
def confirm_bundle_arrival(
    bundle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hub_manager),
):
    """Kho tổng đích xác nhận nhận bundle → tất cả đơn SD chuyển at_hub_hcmc / at_hub_hanoi."""
    from datetime import datetime, timezone
    bundle = db.query(InterProvincialBundle).filter(InterProvincialBundle.bundle_id == bundle_id).first()
    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle không tồn tại")
    if bundle.status != "in_transit":
        raise HTTPException(status_code=400, detail=f"Bundle đang ở trạng thái {bundle.status}")

    hub_wh = _get_manager_warehouse(current_user.user_id, db)
    if not hub_wh or hub_wh.warehouse_id != bundle.dest_hub_id:
        raise HTTPException(status_code=403, detail="Chỉ kho tổng đích mới xác nhận được arrival")

    bundle.status               = "arrived"
    bundle.arrived_confirmed_by = current_user.user_id
    bundle.arrived_at           = datetime.now(timezone.utc)

    # Xác định status mới cho đơn SD dựa trên city kho đích
    dest_city    = (hub_wh.city or "").lower()
    arrived_status = "at_hub_hcmc" if dest_city == "hcmc" else "at_hub_hanoi"

    for link in bundle.shipments:
        s = link.shipment
        if s:
            s.status               = arrived_status
            s.current_warehouse_id = hub_wh.warehouse_id
            log = ShipmentLog(
                shipment_id=s.shipment_id,
                status=arrived_status,
                warehouse_id=hub_wh.warehouse_id,
                note=f"Bundle {bundle.bundle_code} đã đến {hub_wh.name}",
                created_by=current_user.user_id,
            )
            db.add(log)

    db.commit()
    return {
        "message": f"Xác nhận bundle {bundle.bundle_code} đã đến {hub_wh.name}",
        "arrived_status": arrived_status,
        "total_shipments": bundle.total_shipments,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# SCAN KHO — cập nhật vị trí đơn khi chuyển tay giữa các kho
# ═══════════════════════════════════════════════════════════════════════════════

# Map trạng thái scan theo tier + city
_SCAN_STATUS = {
    ("hanoi", 3): "at_ward_warehouse",
    ("hanoi", 2): "at_district_warehouse",
    ("hanoi", 1): "at_hub_hanoi",
    ("hcmc",  1): "at_hub_hcmc",
    ("hcmc",  2): "at_district_hcmc",
    ("hcmc",  3): "at_ward_hcmc",
}


@router.post("/scan")
def scan_shipment_at_warehouse(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_warehouse_manager),
):
    """
    Scan mã đơn SD khi nhập kho.
    Tự động cập nhật current_warehouse_id + status + ghi ShipmentLog.
    """
    delivery_code = data.get("delivery_code")
    shipment_id   = data.get("shipment_id")
    note          = data.get("note", "")

    shipment = None
    if delivery_code:
        shipment = db.query(Shipment).filter(Shipment.delivery_code == delivery_code).first()
    elif shipment_id:
        shipment = db.query(Shipment).filter(Shipment.shipment_id == shipment_id).first()

    if not shipment:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    # Lấy kho của manager hiện tại
    wh = _get_manager_warehouse(current_user.user_id, db)
    if not wh:
        raise HTTPException(status_code=400, detail="Bạn chưa được gán vào kho nào")

    city = (wh.city or "").lower()
    tier = wh.tier or 3
    new_status = _SCAN_STATUS.get((city, tier), f"at_warehouse_{tier}")

    shipment.current_warehouse_id = wh.warehouse_id
    shipment.status = new_status

    log = ShipmentLog(
        shipment_id=shipment.shipment_id,
        warehouse_id=wh.warehouse_id,
        status=new_status,
        note=note or f"Nhập kho {wh.name}",
        created_by=current_user.user_id,
    )
    db.add(log)
    db.commit()

    return {
        "message": f"Đơn {shipment.delivery_code} đã được scan tại {wh.name}",
        "delivery_code": shipment.delivery_code,
        "new_status":    new_status,
        "warehouse":     wh.name,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# TRACK CÔNG KHAI — khách hàng tra cứu mã đơn (không cần đăng nhập)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/track/{delivery_code}")
def public_track(delivery_code: str, db: Session = Depends(get_db)):
    """
    Tra cứu trạng thái đơn theo mã SD.
    Không trả SĐT, không trả tên shipper — chỉ trạng thái + vị trí kho.
    """
    shipment = db.query(Shipment).filter(Shipment.delivery_code == delivery_code).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng với mã này")

    order = shipment.order
    logs = [
        {
            "status":    lg.status,
            "warehouse": lg.warehouse.name if lg.warehouse else None,
            "note":      lg.note,
            "time":      str(lg.created_at),
        }
        for lg in (shipment.logs or [])
    ]

    STATUS_LABEL = {
        "pending":                    "Chờ xử lý",
        "packed":                     "Đã đóng gói",
        "assigned_pickup":            "Đang lấy hàng",
        "at_ward_warehouse":          "Tại kho phường",
        "at_district_warehouse":      "Tại kho quận",
        "at_hub_hanoi":               "Tại kho tổng Hà Nội",
        "in_transit_interprovincial": "Đang vận chuyển liên tỉnh",
        "at_hub_hcmc":                "Tại kho tổng TP.HCM",
        "at_district_hcmc":           "Tại kho quận TP.HCM",
        "at_ward_hcmc":               "Tại kho phường TP.HCM",
        "out_for_delivery":           "Đang giao hàng",
        "delivered":                  "Đã giao thành công",
        "failed":                     "Giao thất bại",
    }

    return {
        "delivery_code":     shipment.delivery_code,
        "status":            shipment.status,
        "status_label":      STATUS_LABEL.get(shipment.status, shipment.status),
        "current_warehouse": (
            shipment.current_warehouse.name if shipment.current_warehouse else None
        ),
        "estimated_city":    (
            shipment.current_warehouse.city if shipment.current_warehouse else None
        ),
        "order_exists":      True,
        "logs":              logs,
    }
