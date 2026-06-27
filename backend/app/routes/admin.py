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
from app.services.product_service import approve_product, reject_product, get_pending_products, get_products
from app.models.product import Product
from app.services.notification_service import create_notification

router = APIRouter()


@router.get("/dashboard")
def dashboard(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    return get_admin_dashboard(db)


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
    return {"message": "User banned", "user_id": user.user_id}


@router.put("/users/{user_id}/unban")
def unban(user_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = unban_user(db, current_user.user_id, user_id)
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
            {"reg_id": r.reg_id, "user_id": r.user_id, "shop_name": r.shop_name, "status": r.status, "created_at": str(r.created_at)}
            for r in items
        ],
        "total": total,
    }


@router.put("/shop-registrations/{reg_id}/approve")
def approve_shop(reg_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    shop = approve_shop_registration(db, current_user.user_id, reg_id)
    return {"message": "Shop approved", "shop_id": shop.shop_id}


@router.put("/shop-registrations/{reg_id}/reject")
def reject_shop(reg_id: int, data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    reject_shop_registration(db, current_user.user_id, reg_id, data.get("reason", ""))
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
            {"reg_id": r.reg_id, "user_id": r.user_id, "vehicle_type": r.vehicle_type, "status": r.status}
            for r in items
        ],
        "total": total,
    }


@router.put("/shipper-registrations/{reg_id}/approve")
def approve_shipper(reg_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    shipper = approve_shipper_registration(db, current_user.user_id, reg_id)
    return {"message": "Shipper approved", "shipper_id": shipper.shipper_id}


@router.put("/shipper-registrations/{reg_id}/reject")
def reject_shipper(reg_id: int, data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    reject_shipper_registration(db, current_user.user_id, reg_id, data.get("reason", ""))
    return {"message": "Shipper registration rejected"}


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
        data["employee_email"], data["employee_name"],
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
            {"emp_id": e.emp_id, "user_id": e.user_id, "emp_name": e.emp_name, "role_name": e.role_name}
            for e in employees
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
                "usage_limit":    v.usage_limit,
                "used_count":     v.used_count,
                "start_date":     str(v.start_date) if v.start_date else None,
                "end_date":       str(v.end_date) if v.end_date else None,
                "is_active":      v.is_active,
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
    rows = (
        db.query(
            extract("year",  Order.created_at).label("year"),
            extract("month", Order.created_at).label("month"),
            func.sum(Order.final_price).label("revenue"),
            func.count(Order.order_id).label("orders"),
        )
        .filter(Order.order_status.notin_(["cancelled", "returned"]))
        .group_by("year", "month")
        .order_by("year", "month")
        .limit(months)
        .all()
    )
    COMMISSION_RATE = 0.10
    return {
        "monthly": [
            {
                "period":     f"{int(r.year)}-{int(r.month):02d}",
                "revenue":    float(r.revenue or 0),
                "commission": round(float(r.revenue or 0) * COMMISSION_RATE, 2),
                "orders":     int(r.orders),
            }
            for r in rows
        ]
    }


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


# ─── Reports ──────────────────────────────────────────────────────────────────

@router.get("/reports/user-growth")
def report_user_growth(
    months: int = Query(6, ge=1, le=24),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Tăng trưởng người dùng theo tháng."""
    rows_new = (
        db.query(
            extract("year",  User.created_at).label("year"),
            extract("month", User.created_at).label("month"),
            func.count(User.user_id).label("new_users"),
        )
        .group_by("year", "month")
        .order_by("year", "month")
        .limit(months)
        .all()
    )
    from app.models.order import Order
    rows_active = (
        db.query(
            extract("year",  Order.created_at).label("year"),
            extract("month", Order.created_at).label("month"),
            func.count(func.distinct(Order.user_id)).label("active_users"),
        )
        .group_by("year", "month")
        .order_by("year", "month")
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
    vouchers = (
        db.query(Voucher)
        .filter(Voucher.used_count > 0)
        .order_by(Voucher.used_count.desc())
        .limit(limit)
        .all()
    )
    return {
        "vouchers": [
            {
                "voucher_id":    v.voucher_id,
                "code":          v.code,
                "uses":          v.used_count,
                "discount_type": v.discount_type,
                "discount_value":float(v.discount_value or 0),
                "discount":      float((v.discount_value or 0) * v.used_count) if v.discount_type == "fixed" else 0,
            }
            for v in vouchers
        ]
    }
