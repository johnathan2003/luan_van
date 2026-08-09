from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.middleware.auth import require_admin, require_superadmin, require_admin_or_superadmin
from app.models.user import User
from app.services.admin_service import (
    get_all_users, ban_user, unban_user,
    get_shop_registrations, approve_shop_registration, reject_shop_registration,
    get_shipper_registrations, approve_shipper_registration, reject_shipper_registration,
    get_deletion_requests, resolve_dispute, get_admin_dashboard, create_system_employee,
)
from app.services.product_service import approve_product, reject_product, get_pending_products, get_products, find_similar_products
from app.models.product import Product
from app.services.notification_service import create_notification

router = APIRouter()


# ─── [S-3] Admin action logger ────────────────────────────────────────────────

def log_admin_action(
    db: Session,
    admin_id: int,
    action: str,
    target_type: str = None,
    target_id: int = None,
    details: dict = None,
):
    """
    Ghi lại hành động của admin vào bảng admin_logs.
    Dùng try/except để không block nếu log thất bại.
    """
    try:
        from app.models.logs import AdminLog
        db.add(AdminLog(
            admin_id=admin_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details or {},
        ))
        # Không commit riêng — để caller commit cùng action chính
    except Exception:
        pass


@router.get("/dashboard")
def dashboard(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    return get_admin_dashboard(db)


# ─── Shops management ──────────────────────────────────────────────────────────

@router.get("/shops")
def list_shops(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from sqlalchemy import text
    conditions = ["1=1"]
    params: dict = {}
    if status:
        conditions.append("status = :status")
        params["status"] = status
    if search:
        conditions.append("shop_name ILIKE :search")
        params["search"] = f"%{search}%"
    where = " AND ".join(conditions)
    try:
        total = db.execute(text(f"SELECT COUNT(*) FROM shops WHERE {where}"), params).scalar() or 0
        offset = (page - 1) * limit
        rows = db.execute(text(f"""
            SELECT shop_id, shop_name, address, phone, rating, verification_status,
                   COALESCE(status, 'active') as status,
                   suspended_reason, suspended_at, created_at
            FROM shops WHERE {where}
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """), {**params, "limit": limit, "offset": offset}).fetchall()
    except Exception:
        db.rollback()
        # Fallback nếu cột status chưa tồn tại
        total = db.execute(text(f"SELECT COUNT(*) FROM shops WHERE {where}"), params).scalar() or 0
        offset = (page - 1) * limit
        rows = db.execute(text(f"""
            SELECT shop_id, shop_name, address, phone, rating, verification_status,
                   'active' as status, NULL as suspended_reason, NULL as suspended_at, created_at
            FROM shops WHERE {where}
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """), {**params, "limit": limit, "offset": offset}).fetchall()
    return {
        "shops": [
            {
                "shop_id": r[0], "shop_name": r[1], "address": r[2], "phone": r[3],
                "rating": str(r[4]) if r[4] else "0.0",
                "verification_status": r[5], "status": r[6] or "active",
                "suspended_reason": r[7], "suspended_at": str(r[8]) if r[8] else None,
                "created_at": str(r[9]) if r[9] else None,
            }
            for r in rows
        ],
        "total": total,
        "pages": (total + limit - 1) // limit,
    }


@router.put("/shops/{shop_id}/suspend")
def suspend_shop(shop_id: int, data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from sqlalchemy import text
    from datetime import datetime as dt

    reason = data.get("reason", "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Vui lòng nhập lý do đình chỉ")

    shop_row = db.execute(text(
        "SELECT shop_id, shop_name FROM shops WHERE shop_id = :sid"
    ), {"sid": shop_id}).fetchone()
    if not shop_row:
        raise HTTPException(status_code=404, detail="Shop không tồn tại")

    in_transit_statuses = ("pending", "confirmed", "processing", "shipped", "delivering")
    try:
        active_rows = db.execute(text("""
            SELECT DISTINCT oi.product_id
            FROM order_items oi
            JOIN orders o ON o.order_id = oi.order_id
            JOIN products p ON p.product_id = oi.product_id
            WHERE p.shop_id = :sid AND o.order_status IN :statuses
        """).bindparams(__import__('sqlalchemy').bindparam("statuses", expanding=True)),
            {"sid": shop_id, "statuses": list(in_transit_statuses)}
        ).fetchall()
        active_pids = [r[0] for r in active_rows]
    except Exception:
        db.rollback()
        active_pids = []

    try:
        if active_pids:
            pid_str = ",".join(str(i) for i in active_pids)
            db.execute(text(f"""
                UPDATE products SET status='archived'
                WHERE shop_id=:sid AND status='active' AND product_id NOT IN ({pid_str})
            """), {"sid": shop_id})
        else:
            db.execute(text(
                "UPDATE products SET status='archived' WHERE shop_id=:sid AND status='active'"
            ), {"sid": shop_id})

        db.execute(text("""
            UPDATE shops SET status='suspended', suspended_reason=:reason, suspended_at=:now
            WHERE shop_id=:sid
        """), {"reason": reason, "now": dt.utcnow(), "sid": shop_id})
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi đình chỉ shop: {str(e)}")

    try:
        create_notification(db, shop_id, "Shop bị đình chỉ",
            f"Shop '{shop_row[1]}' đã bị đình chỉ. Lý do: {reason}", "warning")
    except Exception:
        pass

    return {"message": "Đã đình chỉ shop", "shop_id": shop_id}


@router.put("/shops/{shop_id}/unsuspend")
def unsuspend_shop(shop_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from sqlalchemy import text

    shop_row = db.execute(text(
        "SELECT shop_id, shop_name FROM shops WHERE shop_id = :sid"
    ), {"sid": shop_id}).fetchone()
    if not shop_row:
        raise HTTPException(status_code=404, detail="Shop không tồn tại")

    try:
        db.execute(text("""
            UPDATE shops SET status='active', suspended_reason=NULL, suspended_at=NULL
            WHERE shop_id=:sid
        """), {"sid": shop_id})
        db.execute(text(
            "UPDATE products SET status='active' WHERE shop_id=:sid AND status='archived'"
        ), {"sid": shop_id})
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi kích hoạt shop: {str(e)}")

    try:
        create_notification(db, shop_id, "Shop đã được kích hoạt",
            f"Shop '{shop_row[1]}' đã được kích hoạt trở lại.", "info")
    except Exception:
        pass

    return {"message": "Đã kích hoạt shop", "shop_id": shop_id}


@router.delete("/shops/{shop_id}")
def delete_shop(shop_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from sqlalchemy import text

    shop_row = db.execute(text(
        "SELECT shop_id FROM shops WHERE shop_id = :sid"
    ), {"sid": shop_id}).fetchone()
    if not shop_row:
        raise HTTPException(status_code=404, detail="Shop không tồn tại")

    try:
        # Cascade xóa đúng thứ tự để tránh FK violation
        # Lấy danh sách product_id của shop
        pid_sub = "SELECT product_id FROM products WHERE shop_id = :sid"

        # 1. carts → products
        db.execute(text(f"DELETE FROM carts WHERE product_id IN ({pid_sub})"), {"sid": shop_id})
        # 2. product_reviews → products
        db.execute(text(f"DELETE FROM product_reviews WHERE product_id IN ({pid_sub})"), {"sid": shop_id})
        # 3. stock_reservations → products
        db.execute(text(f"DELETE FROM stock_reservations WHERE product_id IN ({pid_sub})"), {"sid": shop_id})
        # 4. product_deletion_audit_log → product_deletion_requests → products
        db.execute(text(f"""
            DELETE FROM product_deletion_audit_log
            WHERE request_id IN (
                SELECT request_id FROM product_deletion_requests WHERE product_id IN ({pid_sub})
            )
        """), {"sid": shop_id})
        db.execute(text(f"DELETE FROM product_deletion_requests WHERE product_id IN ({pid_sub})"), {"sid": shop_id})
        # 5. order_items → products
        db.execute(text(f"DELETE FROM order_items WHERE product_id IN ({pid_sub})"), {"sid": shop_id})
        # 6. product_variants → products
        db.execute(text(f"DELETE FROM product_variants WHERE product_id IN ({pid_sub})"), {"sid": shop_id})
        # 7. products → shops
        db.execute(text("DELETE FROM products WHERE shop_id = :sid"), {"sid": shop_id})
        # 8. banner_bids của shop (shop_id FK, DB có CASCADE nhưng xóa tường minh cho chắc)
        db.execute(text("DELETE FROM banner_bids WHERE shop_id = :sid"), {"sid": shop_id})
        # 9. shop_employees → shops (không có ON DELETE CASCADE)
        db.execute(text("DELETE FROM employee_role_permissions WHERE employee_id IN (SELECT employee_id FROM shop_employees WHERE shop_id = :sid)"), {"sid": shop_id})
        db.execute(text("DELETE FROM shop_employees WHERE shop_id = :sid"), {"sid": shop_id})
        # 10. shop_wallet_transactions & shop_wallet (có ON DELETE CASCADE, nhưng xóa tường minh)
        db.execute(text("DELETE FROM shop_wallet_transactions WHERE shop_id = :sid"), {"sid": shop_id})
        db.execute(text("DELETE FROM shop_wallet WHERE shop_id = :sid"), {"sid": shop_id})
        # 11. vouchers (FK tới users.user_id, không cascade)
        db.execute(text("DELETE FROM vouchers WHERE created_by = :sid"), {"sid": shop_id})
        # 12. shop_registrations (FK tới users, không xóa tự động)
        db.execute(text("DELETE FROM shop_registrations WHERE user_id = :sid"), {"sid": shop_id})
        # 13. Xóa role 'shop' khỏi user_roles — dùng USING JOIN cho chắc
        db.execute(text("""
            DELETE FROM user_roles
            USING roles
            WHERE user_roles.role_id = roles.role_id
              AND roles.role_name = 'shop'
              AND user_roles.user_id = :sid
        """), {"sid": shop_id})
        # 14. Cuối cùng xóa shop (banner_auctions.winner_shop_id sẽ SET NULL tự động)
        db.execute(text("DELETE FROM shops WHERE shop_id = :sid"), {"sid": shop_id})
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi xóa shop: {str(e)}")

    return {"message": "Đã xóa shop", "shop_id": shop_id}


# ─── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users")
def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1),
    user_status: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    items, total, pages = get_all_users(db, page, limit, user_status=user_status)
    return {
        "users": [
            {
                "user_id": u.user_id,
                "email": u.email,
                "full_name": u.full_name,
                "status": u.status,
                "created_at": str(u.created_at),
                "roles": [ur.role.role_name for ur in u.user_roles if ur.status == "active"],
            }
            for u in items
        ],
        "total": total,
        "pages": pages,
    }


@router.put("/users/{user_id}/ban")
def ban(user_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = ban_user(db, current_user.user_id, user_id)
    log_admin_action(db, current_user.user_id, "ban_user", "user", user_id)  # [S-3]
    db.commit()
    return {"message": "User banned", "user_id": user.user_id}


@router.put("/users/{user_id}/unban")
def unban(user_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = unban_user(db, current_user.user_id, user_id)
    log_admin_action(db, current_user.user_id, "unban_user", "user", user_id)  # [S-3]
    db.commit()
    return {"message": "User unbanned", "user_id": user.user_id}


# ─── Shop Registrations ─────────────────────────────────────────────────────────

@router.get("/shop-registrations")
def shop_regs(
    page: int = 1, limit: int = 20, status: str = "pending",
    current_user: User = Depends(require_admin), db: Session = Depends(get_db),
):
    items, total, pages = get_shop_registrations(db, page, limit, status)
    return {
        "registrations": [
            {
                "reg_id":            r.reg_id,
                "user_id":           r.user_id,
                "full_name":         r.user.full_name if r.user else None,
                "shop_name":         r.shop_name,
                "description":       r.description,
                "address":           r.address,
                "product_images":    r.product_images,
                "business_reg_url":  r.business_reg_url,
                "status":            r.status,
                "created_at":        r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else None,
            }
            for r in items
        ],
        "total": total,
    }


@router.put("/shop-registrations/{reg_id}/approve")
def approve_shop(reg_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    shop = approve_shop_registration(db, current_user.user_id, reg_id)
    log_admin_action(db, current_user.user_id, "approve_shop", "shop_registration", reg_id)  # [S-3]
    db.commit()
    return {"message": "Shop approved", "shop_id": shop.shop_id}


@router.put("/shop-registrations/{reg_id}/reject")
def reject_shop(reg_id: int, data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    reject_shop_registration(db, current_user.user_id, reg_id, data.get("reason", ""))
    log_admin_action(db, current_user.user_id, "reject_shop", "shop_registration", reg_id, {"reason": data.get("reason")})  # [S-3]
    db.commit()
    return {"message": "Shop registration rejected"}


# ─── Shipper Registrations ────────────────────────────────────────────────────

@router.get("/shipper-registrations")
def shipper_regs(
    page: int = 1, limit: int = 20, status: str = "pending",
    current_user: User = Depends(require_admin), db: Session = Depends(get_db),
):
    items, total, pages = get_shipper_registrations(db, page, limit, status)
    return {
        "registrations": [
            {
                "reg_id":           r.reg_id,
                "user_id":          r.user_id,
                "full_name":        r.user.full_name if r.user else None,
                "email":            r.user.email if r.user else None,
                "phone":            r.user.phone if r.user else None,
                "vehicle_type":     r.vehicle_type,
                "license_plate":    r.license_plate,
                "shipper_type":     r.shipper_type,
                "zone_province":    r.zone_province,
                "zone_district":    getattr(r, "zone_district", None),
                "zone_ward":        getattr(r, "zone_ward", None),
                "home_warehouse_id": r.home_warehouse_id,
                "license_url":      r.license_url,
                "registration_url": r.registration_url,
                "vehicle_photo_url": getattr(r, "vehicle_photo_url", None),
                "id_card_url":      r.id_card_url,
                "status":           r.status,
                "rejection_reason": r.rejection_reason,
                "reviewed_by_name": r.reviewer.full_name if r.reviewer else None,
                "reviewed_at":      r.reviewed_at.isoformat() if r.reviewed_at else None,
                "created_at":       r.created_at.isoformat() if r.created_at else None,
            }
            for r in items
        ],
        "total": total,
        "pages": pages,
    }


@router.put("/shipper-registrations/{reg_id}/approve")
def approve_shipper(reg_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    shipper = approve_shipper_registration(db, current_user.user_id, reg_id)
    log_admin_action(db, current_user.user_id, "approve_shipper", "shipper_registration", reg_id)  # [S-3]
    db.commit()
    return {"message": "Shipper approved", "shipper_id": shipper.shipper_id}


@router.put("/shipper-registrations/{reg_id}/reject")
def reject_shipper(reg_id: int, data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    reject_shipper_registration(db, current_user.user_id, reg_id, data.get("reason", ""))
    log_admin_action(db, current_user.user_id, "reject_shipper", "shipper_registration", reg_id, {"reason": data.get("reason")})  # [S-3]
    db.commit()
    return {"message": "Shipper registration rejected"}


@router.get("/shippers")
def list_shippers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Danh sách shipper khu vực + liên tỉnh (không còn loại tự do)."""
    from app.models.shipment import Shipper
    query = db.query(Shipper).join(User, User.user_id == Shipper.user_id)
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()
    result = []
    for s in items:
        result.append({
            "user_id":            s.user_id,
            "shipper_id":         s.shipper_id,
            "full_name":          s.user.full_name,
            "email":              s.user.email,
            "phone":              s.user.phone,
            "vehicle_type":       s.vehicle_type,
            "license_plate":      s.license_plate,
            "shipper_type":       getattr(s, "shipper_type", "zone"),
            "zone_province":      getattr(s, "zone_province", None),
            "home_warehouse_id":  getattr(s, "home_warehouse_id", None),
            "status":             s.status,
        })
    return {"shippers": result, "total": total, "page": page, "pages": -(-total // limit)}


# [F-5] Admin tạo bonus cho shipper
@router.post("/shippers/{shipper_id}/bonus", status_code=201)
def create_shipper_bonus(
    shipper_id: int,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin tạo bonus thủ công cho shipper."""
    from app.models.shipment import Shipper, ShipperBonus
    s = db.query(Shipper).filter(Shipper.shipper_id == shipper_id).first()
    if not s:
        raise HTTPException(404, "Không tìm thấy shipper")
    if not data.get("title") or not data.get("reward"):
        raise HTTPException(400, "Thiếu title hoặc reward")
    bonus = ShipperBonus(
        shipper_id=shipper_id,
        type=data.get("type", "manual"),   # manual | performance | milestone
        title=data["title"],
        reward=data["reward"],
        period=data.get("period"),
        status="received",
    )
    db.add(bonus)
    db.commit()
    return {"message": "Đã tạo bonus", "bonus_id": bonus.bonus_id}


# [F-6] Admin xem incidents của shipper
@router.get("/shipper-incidents")
def list_shipper_incidents(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin xem toàn bộ sự cố shipper."""
    from app.models.shipment import ShipperIncident
    from app.utils.helpers import paginate
    q = db.query(ShipperIncident)
    if status and status != "all":
        q = q.filter(ShipperIncident.status == status)
    q = q.order_by(ShipperIncident.created_at.desc())
    items, total, pages = paginate(q, page, limit)
    return {
        "incidents": [
            {
                "incident_id":  i.incident_id,
                "shipper_id":   i.shipper_id,
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
        "pages": pages,
    }


@router.patch("/shipper-incidents/{incident_id}")
def resolve_shipper_incident(
    incident_id: int,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin xử lý (resolve/close) sự cố shipper."""
    from app.models.shipment import ShipperIncident
    from datetime import datetime, timezone
    inc = db.query(ShipperIncident).filter(ShipperIncident.incident_id == incident_id).first()
    if not inc:
        raise HTTPException(404, "Không tìm thấy sự cố")
    new_status = data.get("status")
    if new_status:
        inc.status = new_status
    if "support_note" in data:
        inc.support_note = data["support_note"]
    if "is_violation" in data:
        inc.is_violation = bool(data["is_violation"])
    db.commit()
    return {"message": "Đã cập nhật sự cố"}


@router.post("/shippers/{user_id}/assign-warehouse")
def assign_shipper_warehouse(
    user_id: int,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Gán shipper khu vực vào kho phụ trách."""
    from app.models.shipment import Shipper, Warehouse
    warehouse_id = data.get("warehouse_id")
    if not warehouse_id:
        raise HTTPException(400, "warehouse_id is required")
    shipper = db.query(Shipper).filter(Shipper.shipper_id == user_id).first()
    if not shipper:
        raise HTTPException(404, "Không tìm thấy shipper")
    warehouse = db.query(Warehouse).filter(Warehouse.warehouse_id == warehouse_id).first()
    if not warehouse:
        raise HTTPException(404, "Không tìm thấy kho")
    shipper.home_warehouse_id = warehouse_id
    shipper.zone_province = warehouse.province
    db.commit()
    return {"message": f"Đã gán shipper vào {warehouse.name}"}


# ─── Warehouse Managers — tạo thẳng từ admin, không qua shipper ──────────────

@router.get("/warehouse-managers")
def list_warehouse_managers(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Danh sách quản lý kho (nhân viên hệ thống do admin chỉ định)."""
    from app.models.user import UserRole, Role
    from app.models.shipment import WarehouseManager, Warehouse
    wm_role = db.query(Role).filter(Role.role_name == "Admin_emp").first()
    if not wm_role:
        return {"managers": []}
    active_wm_ids = [ur.user_id for ur in db.query(UserRole).filter(
        UserRole.role_id == wm_role.role_id, UserRole.status == "active"
    ).all()]
    result = []
    for uid in active_wm_ids:
        u = db.query(User).filter(User.user_id == uid).first()
        if not u:
            continue
        wm = db.query(WarehouseManager).filter(WarehouseManager.manager_id == uid).first()
        wh = db.query(Warehouse).filter(Warehouse.warehouse_id == wm.warehouse_id).first() if wm else None
        result.append({
            "user_id":       u.user_id,
            "full_name":     u.full_name,
            "email":         u.email,
            "phone":         u.phone,
            "status":        u.status,
            "warehouse_id":  wm.warehouse_id if wm else None,
            "warehouse_name": wh.name if wh else None,
            "province":      wh.province if wh else None,
        })
    return {"managers": result}


@router.post("/warehouse-managers")
def create_warehouse_manager(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Tạo tài khoản quản lý kho trực tiếp (không qua shipper).
    LƯU Ý: endpoint cũ, không dùng ở UI nữa (đã gộp vào /admin/warehouse-hierarchy +
    /api/v1/warehouse-accounts). Giữ lại để tương thích ngược, nhưng role gán ra
    giờ tier-aware (theo Warehouse.tier) giống assign_warehouse_manager — tránh gán
    nhầm role "Admin_emp" (Quản lý tổng) cho kho hub/district/ward.
    """
    from app.models.user import UserRole, Role
    from app.models.shipment import WarehouseManager, Warehouse
    from app.utils.security import hash_password

    email        = data.get("email", "").strip()
    full_name    = data.get("full_name", "").strip()
    password     = data.get("password", "")
    phone        = data.get("phone", "")
    warehouse_id = data.get("warehouse_id")

    if not email or not full_name or not password or not warehouse_id:
        raise HTTPException(400, "Thiếu thông tin bắt buộc")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, "Email đã được sử dụng")

    wh = db.query(Warehouse).filter(Warehouse.warehouse_id == warehouse_id).first()
    if not wh:
        raise HTTPException(404, "Không tìm thấy kho")

    # Tạo user
    new_user = User(
        email=email,
        password_hash=hash_password(password),
        full_name=full_name,
        phone=phone,
        status="active",
    )
    db.add(new_user)
    db.flush()

    # Role theo đúng tier của kho (1=hub, 2=district, 3=ward) — KHÔNG hardcode
    # "Admin_emp" (role đó chỉ dành cho Quản lý tổng, không gắn 1 kho cụ thể).
    TIER_ROLES = {1: "warehouse_hub_manager", 2: "warehouse_district_manager", 3: "warehouse_ward_manager"}
    role_name = TIER_ROLES.get(wh.tier, "warehouse_hub_manager")
    wm_role = db.query(Role).filter(Role.role_name == role_name).first()
    if not wm_role:
        wm_role = Role(role_name=role_name, description=f"BuyZo — quản lý kho tier {wh.tier}")
        db.add(wm_role)
        db.flush()
    db.add(UserRole(user_id=new_user.user_id, role_id=wm_role.role_id, status="active",
                     current_role=True, assigned_by=current_user.user_id))

    # Gán kho
    db.add(WarehouseManager(manager_id=new_user.user_id, warehouse_id=warehouse_id))
    db.commit()
    return {"message": f"Đã tạo tài khoản quản lý kho cho {full_name}", "user_id": new_user.user_id}


@router.delete("/warehouse-managers/{user_id}")
def delete_warehouse_manager(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Xóa tài khoản quản lý kho."""
    from app.models.user import UserRole, Role
    from app.models.shipment import WarehouseManager
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(404, "Không tìm thấy người dùng")
    # Vô hiệu hóa role
    wm_role = db.query(Role).filter(Role.role_name == "Admin_emp").first()
    if wm_role:
        ur = db.query(UserRole).filter(UserRole.user_id == user_id, UserRole.role_id == wm_role.role_id).first()
        if ur:
            ur.status = "inactive"
    # Xóa bản ghi WarehouseManager
    wm = db.query(WarehouseManager).filter(WarehouseManager.manager_id == user_id).first()
    if wm:
        db.delete(wm)
    user.status = "inactive"
    db.commit()
    return {"message": f"Đã xóa tài khoản quản lý kho của {user.full_name}"}


# ─── Products ────────────────────────────────────────────────────────────────

@router.get("/products")
def all_products(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    """Admin + Superadmin: xem toàn bộ sản phẩm, filter theo status + search."""
    q = db.query(Product).filter(Product.deleted_at.is_(None))
    if status and status != "all":
        q = q.filter(Product.status == status)
    if search:
        q = q.filter(Product.product_name.ilike(f"%{search}%"))
    total = q.count()
    items = q.order_by(Product.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    # Với sản phẩm đang chờ duyệt → tìm luôn sản phẩm tên tương tự đã tồn tại
    # trên sàn, để admin thấy cảnh báo "có N sản phẩm tương tự" ngay khi duyệt,
    # tránh đăng trùng lặp hàng hoá.
    def _similar_for(p: Product):
        if p.status != "pending":
            return []
        return find_similar_products(db, p.product_name, exclude_product_id=p.product_id, limit=3)

    return {
        "products": [
            {
                "product_id": p.product_id,
                "product_name": p.product_name,
                "shop_id": p.shop_id,
                "price": str(p.price),
                "stock_quantity": p.stock_quantity,
                "image_urls": p.image_urls or [],
                "status": p.status,
                "is_featured": getattr(p, "is_featured", False),
                "sales_count": p.sales_count,
                "similar_products": _similar_for(p),
            }
            for p in items
        ],
        "total": total,
        "page": page,
    }


@router.patch("/products/{product_id}/image")
def update_product_image(
    product_id: int,
    data: dict,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Superadmin ONLY: cập nhật image_urls trực tiếp vào DB, không ghi log, không kiểm tra shop."""
    product = db.query(Product).filter(
        Product.product_id == product_id,
        Product.deleted_at.is_(None),
    ).first()
    if not product:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Product not found")
    image_urls = data.get("image_urls", [])
    product.image_urls = image_urls
    db.commit()
    return {"message": "Image updated", "product_id": product_id, "image_urls": image_urls}


@router.get("/products/pending")
def pending_products(page: int = 1, limit: int = 20, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    items, total, pages = get_pending_products(db, page, limit)
    return {
        "products": [{"product_id": p.product_id, "product_name": p.product_name, "shop_id": p.shop_id, "status": p.status} for p in items],
        "total": total,
    }


@router.put("/products/{product_id}/approve")
def approve_prod(product_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    product = approve_product(db, product_id, current_user.user_id)
    create_notification(
        db,
        user_id=product.shop_id,
        title="✅ Sản phẩm được duyệt",
        message=f"Sản phẩm «{product.product_name}» đã được duyệt và đang được bày bán trên hệ thống.",
        notif_type="product_approved",
        related_entity_type="product",
        related_entity_id=product_id,
        action_url="/shop/products",
    )
    return {"message": "Product approved", "product_id": product_id, "product_name": product.product_name}


@router.put("/products/{product_id}/reject")
def reject_prod(product_id: int, data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    product = reject_product(db, product_id, data.get("reason", ""))
    return {"message": "Product rejected"}


# ─── Deletion Requests ───────────────────────────────────────────────────────

@router.get("/deletion-requests")
def deletion_reqs(page: int = 1, limit: int = 20, status: str = "pending", current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    items, total, pages = get_deletion_requests(db, page, limit, status)
    return {
        "requests": [
            {"deletion_req_id": r.deletion_req_id, "product_id": r.product_id, "reason": r.reason, "status": r.status}
            for r in items
        ],
        "total": total,
    }


# ─── Disputes ────────────────────────────────────────────────────────────────

@router.get("/disputes")
def list_disputes(page: int = 1, limit: int = 20, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.dispute import Dispute
    from app.utils.helpers import paginate
    items, total, pages = paginate(db.query(Dispute).filter(Dispute.status == "open"), page, limit)
    return {
        "disputes": [
            {"dispute_id": d.dispute_id, "order_id": d.order_id, "initiated_party": d.initiated_party, "status": d.status}
            for d in items
        ],
        "total": total,
    }


@router.put("/disputes/{dispute_id}/resolve")
def resolve_disp(dispute_id: int, data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    resolve_dispute(db, current_user.user_id, dispute_id, data.get("decision"), data.get("resolution_details", ""))
    return {"message": "Dispute resolved"}


# ─── System Employees ─────────────────────────────────────────────────────────

@router.post("/system-employees", status_code=201)
def add_sys_employee(data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    emp = create_system_employee(
        db, current_user.user_id,
        data["employee_username"], data["employee_name"],
        data.get("role_name", "general"),
        data.get("permissions", []),
    )
    return {"message": "System employee created", "emp_id": emp.emp_id}


@router.get("/system-employees")
def list_sys_employees(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.shop import SystemEmployee
    employees = db.query(SystemEmployee).filter(SystemEmployee.status == "active").all()
    return {
        "employees": [
            {
                "emp_id":    e.emp_id,
                "user_id":   e.user_id,
                "emp_name":  e.emp_name,
                "email":     e.user.email if e.user else None,
                "role_name": e.role_name,
                "status":    e.status,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "permissions": [p.permission_code for p in e.permissions],
            }
            for e in employees
        ]
    }


@router.put("/system-employees/{emp_id}/permissions")
def update_employee_permissions(
    emp_id: int, data: dict,
    current_user: User = Depends(require_admin), db: Session = Depends(get_db),
):
    """Cập nhật bộ quyền cho nhân viên (replace all permissions)."""
    from app.models.shop import SystemEmployee, SystemEmployeePermission
    from app.services.admin_service import _sync_warehouse_manage, WAREHOUSE_CREATE_PERMS
    emp = db.query(SystemEmployee).filter(SystemEmployee.emp_id == emp_id).first()
    if not emp:
        raise HTTPException(404, "Nhân viên không tồn tại")
    new_perms: list = data.get("permissions", [])
    # Xóa toàn bộ quyền cũ (trừ 3 quyền warehouse_create_* — do _sync_warehouse_manage tự quản lý bên dưới)
    db.query(SystemEmployeePermission).filter(
        SystemEmployeePermission.emp_id == emp_id,
        ~SystemEmployeePermission.permission_code.in_(WAREHOUSE_CREATE_PERMS),
    ).delete(synchronize_session=False)
    # Thêm quyền mới
    for perm_code in new_perms:
        if perm_code in WAREHOUSE_CREATE_PERMS:
            continue  # quyền này do _sync_warehouse_manage cấp theo checkbox warehouse_manage
        db.add(SystemEmployeePermission(
            emp_id=emp_id,
            permission_code=perm_code,
            scope="admin",
            granted_by=current_user.user_id,
        ))
    db.flush()
    _sync_warehouse_manage(db, emp, new_perms, current_user.user_id)
    db.commit()
    return {"message": f"Đã cập nhật {len(new_perms)} quyền cho nhân viên #{emp_id}"}


@router.post("/system-employees/{emp_id}/reset-password")
def reset_sys_employee_password(
    emp_id: int,
    current_user: User = Depends(require_admin), db: Session = Depends(get_db),
):
    """Đặt lại mật khẩu nhân viên hệ thống về mặc định (= phần trước @ trong email)."""
    from app.models.shop import SystemEmployee
    from app.utils.security import hash_password

    emp = db.query(SystemEmployee).filter(SystemEmployee.emp_id == emp_id).first()
    if not emp:
        raise HTTPException(404, "Nhân viên không tồn tại")
    user = db.query(User).filter(User.user_id == emp.user_id).first()
    if not user:
        raise HTTPException(404, "Không tìm thấy tài khoản")

    local_part = user.email.split("@")[0]
    user.password_hash = hash_password(local_part)
    db.commit()
    return {
        "message": f"Đã đặt lại mật khẩu về mặc định cho {emp.emp_name}",
        "email": user.email,
        "password": local_part,
    }


@router.delete("/system-employees/{emp_id}")
def delete_sys_employee(
    emp_id: int,
    current_user: User = Depends(require_admin), db: Session = Depends(get_db),
):
    """Xóa (deactivate) nhân viên hệ thống."""
    from app.models.shop import SystemEmployee
    from app.services.admin_service import _sync_warehouse_manage
    emp = db.query(SystemEmployee).filter(SystemEmployee.emp_id == emp_id).first()
    if not emp:
        raise HTTPException(404, "Nhân viên không tồn tại")
    emp.status = "inactive"
    # Thu hồi role warehouse_manager + 3 quyền warehouse_create_* nếu có —
    # tránh trường hợp nhân viên "đã xoá" vẫn đăng nhập được portal /warehouse
    # hoặc vẫn tạo được tài khoản con.
    _sync_warehouse_manage(db, emp, [], current_user.user_id)
    db.commit()
    return {"message": f"Đã vô hiệu hóa nhân viên {emp.emp_name}"}


# ─── Warehouse Manager Assignment (assign existing user) ──────────────────────

@router.post("/warehouse-managers/assign")
def assign_warehouse_manager(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Gán một user hiện có làm quản lý kho theo tier."""
    from app.models.user import UserRole, Role
    from app.models.shipment import WarehouseManager, Warehouse

    user_id      = data.get("user_id")
    warehouse_id = data.get("warehouse_id")
    if not user_id or not warehouse_id:
        raise HTTPException(400, "Thiếu user_id hoặc warehouse_id")

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(404, "Không tìm thấy người dùng")

    wh = db.query(Warehouse).filter(Warehouse.warehouse_id == warehouse_id).first()
    if not wh:
        raise HTTPException(404, "Không tìm thấy kho")

    # Chọn role theo tier
    TIER_ROLES = {
        1: "warehouse_hub_manager",
        2: "warehouse_district_manager",
        3: "warehouse_ward_manager",
    }
    role_name = TIER_ROLES.get(wh.tier, "Admin_emp")

    # Gỡ kho cũ nếu user đang quản lý kho khác
    old_wm = db.query(WarehouseManager).filter(WarehouseManager.manager_id == user_id).first()
    if old_wm:
        db.delete(old_wm)

    # Gỡ mọi role kho cũ của user này
    old_role_names = list(TIER_ROLES.values()) + ["Admin_emp"]
    for rn in old_role_names:
        old_role = db.query(Role).filter(Role.role_name == rn).first()
        if old_role:
            old_ur = db.query(UserRole).filter(
                UserRole.user_id == user_id, UserRole.role_id == old_role.role_id
            ).first()
            if old_ur:
                db.delete(old_ur)

    # Gán role mới
    new_role = db.query(Role).filter(Role.role_name == role_name).first()
    if not new_role:
        new_role = Role(role_name=role_name, description=f"Quan ly kho tier {wh.tier}")
        db.add(new_role)
        db.flush()
    db.add(UserRole(
        user_id=user_id, role_id=new_role.role_id,
        assigned_by=current_user.user_id, current_role=False, status="active",
    ))

    # Gỡ kho manager cũ của warehouse này (nếu có)
    existing_wm = db.query(WarehouseManager).filter(WarehouseManager.warehouse_id == warehouse_id).first()
    if existing_wm:
        db.delete(existing_wm)

    # Tạo liên kết mới
    db.add(WarehouseManager(manager_id=user_id, warehouse_id=warehouse_id))
    db.commit()

    return {
        "message": f"Đã gán {user.full_name} làm quản lý {wh.name} (tier {wh.tier})",
        "role_assigned": role_name,
        "warehouse_name": wh.name,
    }


@router.delete("/warehouse-managers/{user_id}/unassign")
def unassign_warehouse_manager(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Gỡ quyền quản lý kho của một user."""
    from app.models.user import UserRole, Role
    from app.models.shipment import WarehouseManager

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(404, "Không tìm thấy người dùng")

    # Xóa liên kết kho
    wm = db.query(WarehouseManager).filter(WarehouseManager.manager_id == user_id).first()
    if wm:
        db.delete(wm)

    # Thu hồi mọi role kho
    TIER_ROLES = ["warehouse_hub_manager", "warehouse_district_manager", "warehouse_ward_manager", "Admin_emp"]
    for rn in TIER_ROLES:
        r = db.query(Role).filter(Role.role_name == rn).first()
        if r:
            ur = db.query(UserRole).filter(UserRole.user_id == user_id, UserRole.role_id == r.role_id).first()
            if ur:
                db.delete(ur)

    db.commit()
    return {"message": f"Đã gỡ quyền quản lý kho của {user.full_name}"}


# ─── Search users for manager assignment ──────────────────────────────────────

@router.get("/users/search")
def search_users(
    q: str = "",
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Tìm kiếm user theo tên/email để gán làm warehouse manager."""
    if not q or len(q) < 2:
        return {"users": []}
    users = db.query(User).filter(
        (User.full_name.ilike(f"%{q}%")) | (User.email.ilike(f"%{q}%")),
        User.status == "active",
    ).limit(10).all()
    return {
        "users": [
            {"user_id": u.user_id, "full_name": u.full_name, "email": u.email, "phone": u.phone}
            for u in users
        ]
    }


# ─── Mall requests ────────────────────────────────────────────────────────────

@router.get("/mall-requests")
def list_mall_requests(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Danh sách yêu cầu lên Mall đang chờ duyệt."""
    from app.models.shop import Shop
    shops = db.query(Shop).filter(Shop.mall_request_status == "pending").order_by(Shop.mall_requested_at.asc()).all()
    return {
        "requests": [
            {
                "shop_id":       s.shop_id,
                "shop_name":     s.shop_name,
                "address":       s.address,
                "rating":        str(s.rating) if s.rating else "0.0",
                "total_orders":  s.total_orders or 0,
                "requested_at":  s.mall_requested_at.isoformat() if s.mall_requested_at else None,
            }
            for s in shops
        ]
    }


@router.put("/mall-requests/{shop_id}/approve")
def approve_mall(
    shop_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from app.models.shop import Shop
    from fastapi import HTTPException
    shop = db.query(Shop).filter(Shop.shop_id == shop_id).first()
    if not shop:
        raise HTTPException(404, "Shop không tồn tại")
    shop.is_mall = True
    shop.mall_request_status = "approved"
    db.commit()
    return {"message": f"Đã duyệt {shop.shop_name} lên BuyZo Mall"}


@router.put("/mall-requests/{shop_id}/reject")
def reject_mall(
    shop_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from app.models.shop import Shop
    from fastapi import HTTPException
    shop = db.query(Shop).filter(Shop.shop_id == shop_id).first()
    if not shop:
        raise HTTPException(404, "Shop không tồn tại")
    shop.mall_request_status = "rejected"
    db.commit()
    return {"message": "Đã từ chối yêu cầu Mall"}


@router.get("/logs")
def admin_logs(page: int = 1, limit: int = 50, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.logs import AdminLog
    from app.utils.helpers import paginate
    items, total, pages = paginate(db.query(AdminLog).order_by(AdminLog.created_at.desc()), page, limit)
    return {
        "logs": [
            {"log_id": l.log_id, "admin_id": l.admin_id, "action": l.action, "target_type": l.target_type, "created_at": str(l.created_at)}
            for l in items
        ],
        "total": total,
    }


# ─── Orders ──────────────────────────────────────────────────────────────────

@router.get("/orders")
def admin_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    order_status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin: xem toàn bộ đơn hàng trên platform."""
    from app.models.order import Order
    from app.utils.helpers import paginate
    q = db.query(Order)
    if order_status and order_status != "all":
        q = q.filter(Order.order_status == order_status)
    if search:
        q = q.filter(
            (Order.order_number.ilike(f"%{search}%")) |
            (Order.order_id == int(search) if search.isdigit() else False)
        )
    q = q.order_by(Order.created_at.desc())
    items, total, pages = paginate(q, page, limit)
    return {
        "orders": [
            {
                "order_id":       o.order_id,
                "order_number":   o.order_number,
                "user_id":        o.user_id,
                "shop_id":        o.shop_id,
                "shipper_id":     o.shipper_id,
                "total_price":    float(o.total_price or 0),
                "discount_amount":float(o.discount_amount or 0),
                "shipping_fee":   float(o.shipping_fee or 0),
                "final_price":    float(o.final_price or 0),
                "payment_method": o.payment_method,
                "payment_status": o.payment_status,
                "order_status":   o.order_status,
                "shipping_address": o.shipping_address,
                "recipient_name": o.recipient_name,
                "recipient_phone":o.recipient_phone,
                "created_at":     str(o.created_at),
            }
            for o in items
        ],
        "total": total,
        "pages": pages,
    }


@router.post("/orders/{order_id}/assign-shipper")
def admin_assign_shipper(
    order_id: int,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin: gán shipper cho đơn hàng (tạo shipment nếu chưa có)."""
    from app.models.order import Order
    from app.models.shipment import Shipment, Shipper
    shipper_id = data.get("shipper_id")
    if not shipper_id:
        raise HTTPException(400, "Thiếu shipper_id")
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(404, "Đơn hàng không tồn tại")
    shipper = db.query(Shipper).filter(Shipper.user_id == shipper_id).first()
    if not shipper:
        raise HTTPException(404, "Shipper không tồn tại")

    # Tạo hoặc cập nhật shipment
    shipment = db.query(Shipment).filter(Shipment.order_id == order_id).first()
    if not shipment:
        shipment = Shipment(
            order_id=order_id,
            shipper_id=shipper.shipper_id,
            pickup_location=order.shipping_address or "Shop",
            delivery_location=order.shipping_address or "",
            status="assigned",
        )
        db.add(shipment)
    else:
        shipment.shipper_id = shipper.shipper_id
        shipment.status = "assigned"

    order.shipper_id = shipper_id
    if order.order_status in ("ready_to_ship", "shipped"):
        order.order_status = "shipped"

    shipper.status = "on_delivery"
    db.commit()
    return {"message": f"Đã gán shipper #{shipper_id} cho đơn #{order_id}", "shipment_id": shipment.shipment_id}


# ─── Vouchers ────────────────────────────────────────────────────────────────

@router.get("/vouchers")
def admin_vouchers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    voucher_type: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin: xem toàn bộ voucher trên platform (platform + shop)."""
    from app.models.voucher import Voucher
    from app.utils.helpers import paginate
    q = db.query(Voucher)
    if voucher_type and voucher_type != "all":
        q = q.filter(Voucher.voucher_type == voucher_type)
    q = q.order_by(Voucher.created_at.desc())
    items, total, pages = paginate(q, page, limit)
    return {
        "vouchers": [
            {
                "voucher_id":     v.voucher_id,
                "code":           v.code,
                "voucher_type":   v.voucher_type,
                "discount_type":  v.discount_type,
                "discount_value": float(v.discount_value or 0),
                "min_order_value":float(v.min_order_value or 0),
                "max_discount":   float(v.max_discount) if v.max_discount else None,
                "usage_limit":    v.max_uses,           # model dùng max_uses
                "used_count":     v.current_uses,       # model dùng current_uses
                "start_date":     str(v.valid_from) if v.valid_from else None,   # model dùng valid_from
                "end_date":       str(v.valid_to) if v.valid_to else None,       # model dùng valid_to
                "is_active":      v.status == "active",  # model dùng status
                "shop_id":        v.shop_id,
            }
            for v in items
        ],
        "total": total,
        "pages": pages,
    }


# ─── Banners ─────────────────────────────────────────────────────────────────

@router.get("/banners")
def list_banners(
    status: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from app.models.admin_config import Banner
    q = db.query(Banner)
    if status and status != "all":
        q = q.filter(Banner.status == status)
    banners = q.order_by(Banner.display_order.asc(), Banner.created_at.desc()).all()
    return {
        "banners": [
            {
                "banner_id":     b.banner_id,
                "title":         b.title,
                "shop_id":       b.shop_id,
                "shop_name":     b.shop_name,
                "status":        b.status,
                "valid_from":    b.valid_from,
                "valid_to":      b.valid_to,
                "link":          b.link,
                "image_url":     b.image_url,
                "emoji":         b.emoji,
                "color1":        b.color1,
                "color2":        b.color2,
                "display_order": b.display_order,
                "created_at":    b.created_at.isoformat() if b.created_at else None,
            }
            for b in banners
        ]
    }


@router.post("/banners", status_code=201)
def create_banner(data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.admin_config import Banner
    banner = Banner(**{k: v for k, v in data.items() if k in (
        "title", "shop_id", "shop_name", "valid_from", "valid_to",
        "link", "image_url", "emoji", "color1", "color2", "display_order"
    )})
    db.add(banner)
    db.commit()
    db.refresh(banner)
    return {"banner_id": banner.banner_id, "message": "Đã thêm banner"}


@router.patch("/banners/{banner_id}")
def update_banner(banner_id: int, data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.admin_config import Banner
    banner = db.query(Banner).filter(Banner.banner_id == banner_id).first()
    if not banner:
        raise HTTPException(404, "Banner không tồn tại")
    allowed = ("title", "shop_name", "status", "valid_from", "valid_to",
               "link", "image_url", "emoji", "color1", "color2", "display_order")
    for k, v in data.items():
        if k in allowed:
            setattr(banner, k, v)
    db.commit()
    return {"message": "Đã cập nhật banner"}


@router.delete("/banners/{banner_id}")
def delete_banner(banner_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.admin_config import Banner
    banner = db.query(Banner).filter(Banner.banner_id == banner_id).first()
    if not banner:
        raise HTTPException(404, "Banner không tồn tại")
    db.delete(banner)
    db.commit()
    return {"message": "Đã xóa banner"}


# ─── Feedbacks ────────────────────────────────────────────────────────────────

@router.get("/feedbacks")
def list_feedbacks(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    fb_type: Optional[str] = Query(None, alias="type"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from app.models.admin_config import Feedback
    from app.utils.helpers import paginate
    q = db.query(Feedback)
    if status and status != "all":
        q = q.filter(Feedback.status == status)
    if fb_type and fb_type != "all":
        q = q.filter(Feedback.type == fb_type)
    q = q.order_by(Feedback.created_at.desc())
    items, total, pages = paginate(q, page, limit)
    return {
        "feedbacks": [
            {
                "feedback_id": f.feedback_id,
                "user_name":   f.user_name,
                "user_email":  f.user_email,
                "subject":     f.subject,
                "content":     f.content,
                "type":        f.type,
                "status":      f.status,
                "admin_note":  f.admin_note,
                "created_at":  f.created_at.isoformat() if f.created_at else None,
            }
            for f in items
        ],
        "total": total,
        "pages": pages,
    }


@router.patch("/feedbacks/{feedback_id}")
def update_feedback(feedback_id: int, data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.admin_config import Feedback
    fb = db.query(Feedback).filter(Feedback.feedback_id == feedback_id).first()
    if not fb:
        raise HTTPException(404, "Feedback không tồn tại")
    if "status" in data:
        fb.status = data["status"]
    if "admin_note" in data:
        fb.admin_note = data["admin_note"]
    db.commit()
    return {"message": "Đã cập nhật feedback"}


# ─── Finance ─────────────────────────────────────────────────────────────────

@router.get("/finance/revenue-monthly")
def finance_revenue_monthly(
    months: int = Query(6, ge=1, le=24),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Doanh thu platform theo tháng — tổng hợp từ bảng orders."""
    from app.models.order import Order
    # [S-2] GROUP BY expression thay vì alias string — PostgreSQL không hỗ trợ GROUP BY alias
    _yr  = extract("year",  Order.created_at)
    _mo  = extract("month", Order.created_at)
    rows = (
        db.query(
            _yr.label("year"),
            _mo.label("month"),
            func.sum(Order.final_price).label("revenue"),
            func.count(Order.order_id).label("orders"),
        )
        .filter(Order.order_status.notin_(["cancelled", "returned"]))
        .group_by(_yr, _mo)
        .order_by(_yr, _mo)
        .limit(months)
        .all()
    )
    from app.models.admin_config import RevenueConfig
    cfg = db.query(RevenueConfig).filter(RevenueConfig.is_active == True).order_by(RevenueConfig.config_id.desc()).first()
    admin_rate = float(cfg.admin_rate) / 100 if cfg else 0.15
    return {
        "monthly": [
            {
                "period":     f"{int(r.year)}-{int(r.month):02d}",
                "revenue":    float(r.revenue or 0),
                "commission": round(float(r.revenue or 0) * admin_rate, 2),
                "orders":     int(r.orders),
            }
            for r in rows
        ]
    }


@router.get("/finance/shop-revenue")
def finance_shop_revenue(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Tổng kết doanh thu theo từng shop (completed orders)."""
    from app.models.order import Order
    from app.models.shop import Shop

    from app.models.admin_config import RevenueConfig
    _cfg = db.query(RevenueConfig).filter(RevenueConfig.is_active == True).order_by(RevenueConfig.config_id.desc()).first()
    SHOP_RATE    = float(_cfg.shop_rate)    / 100 if _cfg else 0.70
    ADMIN_RATE   = float(_cfg.admin_rate)   / 100 if _cfg else 0.15
    SHIPPER_RATE = float(_cfg.shipper_rate) / 100 if _cfg else 0.05
    VAT_RATE     = float(_cfg.vat_rate)     / 100 if _cfg else 0.10
    FEE_RATE = 1 - SHOP_RATE

    rows = (
        db.query(
            Shop.shop_id,
            Shop.shop_name,
            func.count(Order.order_id).label("total_orders"),
            func.sum(Order.final_price).label("total_revenue"),
            func.max(Order.created_at).label("last_order_at"),
        )
        .join(Order, Order.shop_id == Shop.shop_id)
        .filter(Order.order_status == "completed")
        .group_by(Shop.shop_id, Shop.shop_name)
        .order_by(func.sum(Order.final_price).desc())
        .limit(limit)
        .all()
    )

    result = []
    for r in rows:
        rev   = float(r.total_revenue or 0)
        fee   = round(rev * FEE_RATE,  2)
        profit = round(rev * SHOP_RATE, 2)
        result.append({
            "shop_id":       r.shop_id,
            "shop_name":     r.shop_name,
            "total_orders":  int(r.total_orders or 0),
            "total_revenue": rev,
            "platform_fee":  fee,
            "admin_fee":     round(rev * ADMIN_RATE,   2),
            "shipper_fee":   round(rev * SHIPPER_RATE, 2),
            "vat_fee":       round(rev * VAT_RATE,     2),
            "shop_profit":   profit,
            "last_order_at": (r.last_order_at or "").isoformat()[:16] if r.last_order_at else None,
        })

    return {"shops": result, "total": len(result)}


@router.get("/finance/transactions")
def finance_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    txn_type: Optional[str] = Query(None, alias="type"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from app.models.admin_config import PlatformTransaction
    from app.utils.helpers import paginate
    q = db.query(PlatformTransaction)
    if txn_type and txn_type != "all":
        q = q.filter(PlatformTransaction.type == txn_type)
    q = q.order_by(PlatformTransaction.created_at.desc())
    items, total, pages = paginate(q, page, limit)
    return {
        "transactions": [
            {
                "txn_id":    t.txn_id,
                "type":      t.type,
                "amount":    float(t.amount),
                "shop_name": t.shop_name,
                "order_id":  t.order_id,
                "status":    t.status,
                "note":      t.note,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in items
        ],
        "total": total,
        "pages": pages,
    }


# ─── Shipping Zones ───────────────────────────────────────────────────────────

@router.get("/shipping-zones")
def list_shipping_zones(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.admin_config import ShippingZone
    zones = db.query(ShippingZone).order_by(ShippingZone.zone_id.asc()).all()
    return {
        "zones": [
            {
                "zone_id":        z.zone_id,
                "name":           z.name,
                "provinces":      z.provinces,
                "base_fee":       int(z.base_fee or 0),
                "per_kg":         int(z.per_kg or 0),
                "estimated_days": z.estimated_days,
                "is_active":      z.is_active,
            }
            for z in zones
        ]
    }


@router.post("/shipping-zones", status_code=201)
def create_shipping_zone(data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.admin_config import ShippingZone
    zone = ShippingZone(
        name=data.get("name"),
        provinces=data.get("provinces"),
        base_fee=data.get("base_fee", 0),
        per_kg=data.get("per_kg", 0),
        estimated_days=data.get("estimated_days"),
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return {"zone_id": zone.zone_id, "message": "Đã thêm vùng vận chuyển"}


@router.put("/shipping-zones/{zone_id}")
def update_shipping_zone(zone_id: int, data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.admin_config import ShippingZone
    zone = db.query(ShippingZone).filter(ShippingZone.zone_id == zone_id).first()
    if not zone:
        raise HTTPException(404, "Không tìm thấy vùng vận chuyển")
    for k, v in data.items():
        if k in ("name", "provinces", "base_fee", "per_kg", "estimated_days", "is_active"):
            setattr(zone, k, v)
    db.commit()
    return {"message": "Đã cập nhật vùng vận chuyển"}


@router.delete("/shipping-zones/{zone_id}")
def delete_shipping_zone(zone_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.admin_config import ShippingZone
    zone = db.query(ShippingZone).filter(ShippingZone.zone_id == zone_id).first()
    if not zone:
        raise HTTPException(404, "Không tìm thấy vùng vận chuyển")
    db.delete(zone)
    db.commit()
    return {"message": "Đã xóa vùng vận chuyển"}


# ─── Shipping Methods ─────────────────────────────────────────────────────────

@router.get("/shipping-methods")
def list_shipping_methods(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.admin_config import ShippingMethod
    methods = db.query(ShippingMethod).order_by(ShippingMethod.method_id.asc()).all()
    return {
        "methods": [
            {
                "method_id":   m.method_id,
                "name":        m.name,
                "code":        m.code,
                "description": m.description,
                "is_active":   m.is_active,
            }
            for m in methods
        ]
    }


@router.post("/shipping-methods", status_code=201)
def create_shipping_method(data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.admin_config import ShippingMethod
    exists = db.query(ShippingMethod).filter(ShippingMethod.code == data.get("code")).first()
    if exists:
        raise HTTPException(400, f"Code '{data.get('code')}' đã tồn tại")
    method = ShippingMethod(
        name=data.get("name"),
        code=data.get("code"),
        description=data.get("description"),
        is_active=data.get("is_active", True),
    )
    db.add(method)
    db.commit()
    db.refresh(method)
    return {"method_id": method.method_id, "message": "Đã thêm phương thức vận chuyển"}


@router.put("/shipping-methods/{method_id}")
def update_shipping_method(method_id: int, data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.admin_config import ShippingMethod
    method = db.query(ShippingMethod).filter(ShippingMethod.method_id == method_id).first()
    if not method:
        raise HTTPException(404, "Không tìm thấy phương thức")
    for k, v in data.items():
        if k in ("name", "code", "description", "is_active"):
            setattr(method, k, v)
    db.commit()
    return {"message": "Đã cập nhật phương thức vận chuyển"}


@router.delete("/shipping-methods/{method_id}")
def delete_shipping_method(method_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.admin_config import ShippingMethod
    method = db.query(ShippingMethod).filter(ShippingMethod.method_id == method_id).first()
    if not method:
        raise HTTPException(404, "Không tìm thấy phương thức")
    db.delete(method)
    db.commit()
    return {"message": "Đã xóa phương thức vận chuyển"}


# ─── Shipping Size Tiers ──────────────────────────────────────────────────────

def _tier_dict(t) -> dict:
    return {
        "tier_id":       t.tier_id,
        "tier_level":    t.tier_level,
        "label":         t.label,
        "max_length_cm": t.max_length_cm,
        "max_width_cm":  t.max_width_cm,
        "max_height_cm": t.max_height_cm,
        "max_weight_kg": float(t.max_weight_kg),
        "extra_fee":     t.extra_fee,
        "updated_at":    t.updated_at.isoformat() if t.updated_at else None,
    }


@router.get("/shipping/size-tiers")
def get_size_tiers(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.admin_config import ShippingSizeTier
    tiers = db.query(ShippingSizeTier).order_by(ShippingSizeTier.tier_level).all()
    return {"tiers": [_tier_dict(t) for t in tiers]}


@router.put("/shipping/size-tiers")
def update_size_tiers(data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Cập nhật toàn bộ 5 bậc. Gửi array tiers với các trường có thể thay đổi."""
    from app.models.admin_config import ShippingSizeTier
    rows: list = data.get("tiers", [])
    if not rows:
        raise HTTPException(400, "Thiếu dữ liệu tiers")
    updated = 0
    for row in rows:
        tier_level = row.get("tier_level")
        if not tier_level:
            continue
        t = db.query(ShippingSizeTier).filter(ShippingSizeTier.tier_level == tier_level).first()
        if not t:
            continue
        for field in ("max_length_cm", "max_width_cm", "max_height_cm", "max_weight_kg", "extra_fee", "label"):
            if field in row:
                setattr(t, field, row[field])
        t.updated_by = current_user.user_id
        updated += 1
    db.commit()
    tiers = db.query(ShippingSizeTier).order_by(ShippingSizeTier.tier_level).all()
    return {"message": f"Đã cập nhật {updated} bậc", "tiers": [_tier_dict(t) for t in tiers]}


# ─── Revenue Config ────────────────────────────────────────────────────────────

def _get_active_cfg(db):
    """Trả RevenueConfig đang active, hoặc None."""
    from app.models.admin_config import RevenueConfig
    return db.query(RevenueConfig).filter(RevenueConfig.is_active == True).order_by(RevenueConfig.config_id.desc()).first()


def _cfg_dict(c) -> dict:
    return {
        "config_id":       c.config_id,
        "shop_rate":       float(c.shop_rate),
        "admin_rate":      float(c.admin_rate),
        "shipper_rate":    float(c.shipper_rate),
        "vat_rate":        float(c.vat_rate),
        "changed_at":      c.changed_at.isoformat() if c.changed_at else None,
        "changed_by_name": c.changer.full_name if c.changer else "Hệ thống",
        "note":            c.note,
    }


@router.get("/revenue-config")
def get_revenue_config(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.admin_config import RevenueConfig
    current = _get_active_cfg(db)
    history = (
        db.query(RevenueConfig)
        .order_by(RevenueConfig.config_id.desc())
        .limit(10)
        .all()
    )
    return {
        "current": _cfg_dict(current) if current else None,
        "history": [_cfg_dict(c) for c in history],
    }


@router.put("/revenue-config")
def update_revenue_config(data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Thay đổi % phân chia doanh thu — tạo row mới, deactivate row cũ."""
    from app.models.admin_config import RevenueConfig
    shop_rate    = float(data.get("shop_rate",    70))
    admin_rate   = float(data.get("admin_rate",   15))
    shipper_rate = float(data.get("shipper_rate",  5))
    vat_rate     = float(data.get("vat_rate",     10))
    note         = data.get("note", "")

    total = shop_rate + admin_rate + shipper_rate + vat_rate
    if abs(total - 100) > 0.01:
        raise HTTPException(400, f"Tổng các tỷ lệ phải = 100%, hiện tại: {total}%")
    for name, val in [("shop_rate", shop_rate), ("admin_rate", admin_rate), ("shipper_rate", shipper_rate), ("vat_rate", vat_rate)]:
        if val <= 0 or val >= 100:
            raise HTTPException(400, f"{name} phải trong khoảng (0, 100)")

    # Deactivate tất cả config cũ
    db.query(RevenueConfig).filter(RevenueConfig.is_active == True).update({"is_active": False})

    # Tạo config mới
    new_cfg = RevenueConfig(
        shop_rate=shop_rate, admin_rate=admin_rate,
        shipper_rate=shipper_rate, vat_rate=vat_rate,
        is_active=True, changed_by=current_user.user_id, note=note,
    )
    db.add(new_cfg)
    db.commit()
    db.refresh(new_cfg)
    return {"message": "Đã cập nhật cấu hình doanh thu", "config": _cfg_dict(new_cfg)}


# ─── Reports ──────────────────────────────────────────────────────────────────

@router.get("/reports/user-growth")
def report_user_growth(
    months: int = Query(6, ge=1, le=24),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Tăng trưởng người dùng theo tháng."""
    # [S-2] GROUP BY expression, không dùng string alias
    _u_yr = extract("year",  User.created_at)
    _u_mo = extract("month", User.created_at)
    rows_new = (
        db.query(
            _u_yr.label("year"),
            _u_mo.label("month"),
            func.count(User.user_id).label("new_users"),
        )
        .group_by(_u_yr, _u_mo)
        .order_by(_u_yr, _u_mo)
        .limit(months)
        .all()
    )
    from app.models.order import Order
    _o_yr = extract("year",  Order.created_at)
    _o_mo = extract("month", Order.created_at)
    rows_active = (
        db.query(
            _o_yr.label("year"),
            _o_mo.label("month"),
            func.count(func.distinct(Order.user_id)).label("active_users"),
        )
        .group_by(_o_yr, _o_mo)
        .order_by(_o_yr, _o_mo)
        .limit(months)
        .all()
    )
    active_map = {(int(r.year), int(r.month)): int(r.active_users) for r in rows_active}
    return {
        "growth": [
            {
                "period":  f"{int(r.year)}-{int(r.month):02d}",
                "month":   f"T{int(r.month)}",
                "new":     int(r.new_users),
                "active":  active_map.get((int(r.year), int(r.month)), 0),
                "churned": 0,
            }
            for r in rows_new
        ]
    }


@router.get("/reports/top-products")
def report_top_products(
    limit: int = Query(5, ge=1, le=50),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Top sản phẩm theo doanh số."""
    from app.models.order import OrderItem
    from app.models.product import Product
    rows = (
        db.query(
            OrderItem.product_id,
            Product.product_name,
            func.sum(OrderItem.quantity).label("sales"),
            func.sum(OrderItem.quantity * OrderItem.price_at_order).label("revenue"),
        )
        .join(Product, OrderItem.product_id == Product.product_id)
        .group_by(OrderItem.product_id, Product.product_name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(limit)
        .all()
    )
    return {
        "top_products": [
            {
                "product_id": r.product_id,
                "name":       r.product_name,
                "sales":      int(r.sales or 0),
                "revenue":    float(r.revenue or 0),
            }
            for r in rows
        ]
    }


@router.get("/reports/order-status")
def report_order_status(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Phân bổ đơn hàng theo trạng thái."""
    from app.models.order import Order
    rows = (
        db.query(Order.order_status, func.count(Order.order_id).label("count"))
        .group_by(Order.order_status)
        .all()
    )
    STATUS_LABEL = {
        "pending": "Chờ xử lý", "confirmed": "Đã xác nhận", "paid": "Đã thanh toán",
        "ready_to_ship": "Sẵn giao", "shipped": "Đang giao",
        "delivered": "Đã giao", "completed": "Hoàn thành",
        "cancelled": "Đã hủy", "returned": "Hoàn trả",
    }
    STATUS_COLOR = {
        "pending": "#D97706", "confirmed": "#1D4ED8", "paid": "#7C3AED",
        "ready_to_ship": "#3B82F6", "shipped": "#D97706",
        "delivered": "#16A34A", "completed": "#16A34A",
        "cancelled": "#DC2626", "returned": "#64748B",
    }
    return {
        "order_status": [
            {
                "status": r.order_status,
                "name":   STATUS_LABEL.get(r.order_status, r.order_status),
                "value":  int(r.count),
                "color":  STATUS_COLOR.get(r.order_status, "#64748B"),
            }
            for r in rows
        ]
    }


@router.get("/reports/voucher-usage")
def report_voucher_usage(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Top voucher theo lượt dùng."""
    from app.models.voucher import Voucher
    # [S-1/V-1] dùng current_uses (đúng tên cột), không phải used_count
    vouchers = (
        db.query(Voucher)
        .filter(Voucher.current_uses > 0)
        .order_by(Voucher.current_uses.desc())
        .limit(limit)
        .all()
    )
    return {
        "vouchers": [
            {
                "voucher_id":    v.voucher_id,
                "code":          v.code,
                "uses":          v.current_uses,
                "discount_type": v.discount_type,
                "discount_value":float(v.discount_value or 0),
                "discount":      float((v.discount_value or 0) * v.current_uses) if v.discount_type == "fixed" else 0,
            }
            for v in vouchers
        ]
    }


@router.put("/vouchers/{voucher_id}")
def update_voucher(
    voucher_id: int,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin: cập nhật thông tin voucher."""
    from app.models.voucher import Voucher
    v = db.query(Voucher).filter(Voucher.voucher_id == voucher_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Voucher không tồn tại")
    for field in ("code", "discount_type", "discount_value", "usage_limit", "start_date", "end_date", "is_active", "min_order_value", "max_discount"):
        if field in data and data[field] is not None:
            setattr(v, field, data[field])
    db.commit()
    return {"message": "Đã cập nhật voucher", "voucher_id": voucher_id}


@router.delete("/vouchers/{voucher_id}")
def delete_voucher(
    voucher_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin: xóa voucher."""
    from app.models.voucher import Voucher
    v = db.query(Voucher).filter(Voucher.voucher_id == voucher_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Voucher không tồn tại")
    db.delete(v)
    db.commit()
    return {"message": "Đã xóa voucher"}


@router.post("/vouchers")
def create_voucher(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin: tạo voucher mới."""
    from app.models.voucher import Voucher
    if not data.get("code") or not data.get("discount_value"):
        raise HTTPException(status_code=400, detail="Thiếu thông tin bắt buộc (code, discount_value)")
    existing = db.query(Voucher).filter(Voucher.code == data["code"]).first()
    if existing:
        raise HTTPException(status_code=400, detail="Mã voucher đã tồn tại")
    v = Voucher(
        code=data["code"],
        voucher_type="platform",
        discount_type=data.get("discount_type", "percentage"),
        discount_value=data["discount_value"],
        min_order_value=data.get("min_order_value"),
        max_discount=data.get("max_discount"),
        max_uses=data.get("usage_limit"),            # frontend gửi usage_limit → map sang max_uses
        current_uses=0,
        valid_from=data.get("start_date"),           # frontend gửi start_date → map sang valid_from
        valid_to=data.get("end_date"),               # frontend gửi end_date → map sang valid_to
        status="active" if data.get("is_active", True) else "inactive",  # frontend gửi is_active
        created_by=current_user.user_id,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return {"message": "Đã tạo voucher", "voucher_id": v.voucher_id}


# ─── System Notifications ────────────────────────────────────────────────────

@router.get("/system-notifications")
def list_system_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin: danh sách thông báo hệ thống."""
    from app.models.notification import SystemNotification
    from app.utils.helpers import paginate
    q = db.query(SystemNotification).order_by(SystemNotification.created_at.desc())
    items, total, pages = paginate(q, page, limit)
    return {
        "notifications": [
            {
                "id":         n.id,
                "title":      n.title,
                "content":    n.content,
                "type":       n.type,
                "audience":   n.audience,
                "send_at":    str(n.send_at) if n.send_at else None,
                "sent":       n.sent,
                "created_at": str(n.created_at),
            }
            for n in items
        ],
        "total": total,
        "pages": pages,
    }


@router.post("/system-notifications")
def create_system_notification(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin: tạo thông báo hệ thống mới và tùy chọn gửi ngay."""
    from app.models.notification import SystemNotification
    if not data.get("title") or not data.get("content"):
        raise HTTPException(400, "Thiếu tiêu đề hoặc nội dung")
    sn = SystemNotification(
        title=data["title"],
        content=data["content"],
        type=data.get("type", "info"),
        audience=data.get("audience", "all"),
        send_at=data.get("send_at"),
        created_by=current_user.user_id,
        sent=False,
    )
    db.add(sn)
    db.commit()
    db.refresh(sn)

    # Nếu không có send_at → gửi ngay cho tất cả user phù hợp
    if not sn.send_at:
        _broadcast_system_notification(db, sn, current_user)
        sn.sent = True
        db.commit()

    return {"message": "Đã tạo thông báo", "id": sn.id, "sent": sn.sent}


@router.put("/system-notifications/{notif_id}")
def update_system_notification(
    notif_id: int,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin: cập nhật thông báo hệ thống (chỉ khi chưa gửi)."""
    from app.models.notification import SystemNotification
    sn = db.query(SystemNotification).filter(SystemNotification.id == notif_id).first()
    if not sn:
        raise HTTPException(404, "Không tìm thấy thông báo")
    for field in ("title", "content", "type", "audience", "send_at"):
        if field in data:
            setattr(sn, field, data[field])
    db.commit()
    return {"message": "Đã cập nhật"}


@router.delete("/system-notifications/{notif_id}")
def delete_system_notification(
    notif_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin: xóa thông báo hệ thống."""
    from app.models.notification import SystemNotification
    sn = db.query(SystemNotification).filter(SystemNotification.id == notif_id).first()
    if not sn:
        raise HTTPException(404, "Không tìm thấy thông báo")
    db.delete(sn)
    db.commit()
    return {"message": "Đã xóa"}


@router.post("/system-notifications/{notif_id}/send")
def send_system_notification(
    notif_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin: gửi thông báo hệ thống ngay lập tức."""
    from app.models.notification import SystemNotification
    sn = db.query(SystemNotification).filter(SystemNotification.id == notif_id).first()
    if not sn:
        raise HTTPException(404, "Không tìm thấy thông báo")
    _broadcast_system_notification(db, sn, current_user)
    sn.sent = True
    db.commit()
    return {"message": "Đã gửi thông báo"}


def _broadcast_system_notification(db, sn, sender):
    """Tạo notification riêng cho từng user thuộc audience."""
    from app.models.user import User as UserModel, Role
    from app.services.notification_service import create_notification
    q = db.query(UserModel)
    if sn.audience != "all":
        role_obj = db.query(Role).filter(Role.role_name == sn.audience).first()
        if role_obj:
            from app.models.user import UserRole
            user_ids = [ur.user_id for ur in db.query(UserRole).filter(UserRole.role_id == role_obj.role_id).all()]
            q = q.filter(UserModel.user_id.in_(user_ids))
    users = q.filter(UserModel.status == "active").all()
    for u in users[:500]:   # giới hạn 500 để tránh timeout
        try:
            create_notification(db, u.user_id, sn.title, sn.content, notif_type=sn.type)
        except Exception:
            pass
