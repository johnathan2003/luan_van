"""
Bot tool implementations — DB queries scoped per role.
Each function takes (db, user) and arbitrary kwargs from Claude's tool_use.
Returns a dict that Claude will use to compose the final answer.

Di chuyển từ backend/app/services/bot_tools.py sang chatbot service riêng
(2026-08-04) — logic không đổi, vẫn import model qua `app.models.*` vì
backend/app được mount read-only vào container này (xem docker-compose.yml
+ main.py: sys.path được trỏ tới ./backend_app để package `app` import được).
"""
from __future__ import annotations
import datetime
from typing import Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

# Alias: Shipment được dùng làm "Delivery" trong các tool cũ
# (model Delivery không tồn tại; Shipment là đơn giao thực tế)
_SHIPMENT_AS_DELIVERY = True  # marker


# ─────────────────────────────────────────────
# SHARED helpers
# ─────────────────────────────────────────────

def _period_range(period: str) -> tuple[datetime.datetime, datetime.datetime]:
    now = datetime.datetime.utcnow()
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start = now - datetime.timedelta(days=7)
    elif period == "month":
        start = now - datetime.timedelta(days=30)
    elif period == "year":
        start = now - datetime.timedelta(days=365)
    else:
        start = now - datetime.timedelta(days=30)
    return start, now


# ─────────────────────────────────────────────
# ADMIN tools
# ─────────────────────────────────────────────

def admin_query_stats(db: Session, user: Any, period: str = "month", metric: str = "all") -> dict:
    from app.models.order import Order
    from app.models.user import User as UserModel, UserRole, Role
    from app.models.shop import Shop
    start, end = _period_range(period)

    result: dict = {}
    if metric in ("all", "revenue"):
        revenue = db.query(func.sum(Order.final_price)).filter(
            Order.created_at >= start, Order.order_status == "delivered"
        ).scalar() or 0
        order_count = db.query(func.count(Order.order_id)).filter(
            Order.created_at >= start
        ).scalar() or 0
        result["revenue"] = float(revenue)
        result["order_count"] = order_count

    if metric in ("all", "users"):
        new_users = db.query(func.count(UserModel.user_id)).filter(
            UserModel.created_at >= start
        ).scalar() or 0
        result["new_users"] = new_users

    if metric in ("all", "shops"):
        active_shops = db.query(func.count(Shop.shop_id)).filter(
            Shop.verification_status == "approved"
        ).scalar() or 0
        result["active_shops"] = active_shops

    result["period"] = period
    return result


def admin_filter_shops(db: Session, user: Any, status: str | None = None,
                       search: str | None = None, limit: int = 20) -> dict:
    from app.models.shop import Shop
    q = db.query(Shop)
    if status:
        q = q.filter(Shop.verification_status == status)
    if search:
        q = q.filter(Shop.shop_name.ilike(f"%{search}%"))
    shops = q.order_by(desc(Shop.created_at)).limit(min(limit, 50)).all()
    return {
        "shops": [
            {"shop_id": s.shop_id, "shop_name": s.shop_name,
             "status": s.verification_status, "rating": float(s.rating or 0)}
            for s in shops
        ],
        "total": len(shops),
    }


def admin_filter_orders(db: Session, user: Any, status: str | None = None,
                        period: str = "month", limit: int = 20) -> dict:
    from app.models.order import Order
    start, end = _period_range(period)
    q = db.query(Order).filter(Order.created_at >= start)
    if status:
        q = q.filter(Order.order_status == status)
    orders = q.order_by(desc(Order.created_at)).limit(min(limit, 50)).all()
    return {
        "orders": [
            {"order_id": o.order_id, "status": o.order_status,
             "total_amount": float(o.final_price or 0),
             "created_at": str(o.created_at)}
            for o in orders
        ],
        "count": len(orders),
    }


def admin_get_disputes(db: Session, user: Any, status: str | None = None, limit: int = 20) -> dict:
    from app.models.dispute import Dispute
    q = db.query(Dispute)
    if status:
        q = q.filter(Dispute.status == status)
    disputes = q.order_by(desc(Dispute.created_at)).limit(min(limit, 50)).all()
    return {
        "disputes": [
            {"dispute_id": d.dispute_id, "status": d.status,
             "reason": d.reason, "created_at": str(d.created_at)}
            for d in disputes
        ],
        "count": len(disputes),
    }


def admin_top_shops(db: Session, user: Any, metric: str = "revenue", period: str = "month", limit: int = 5) -> dict:
    from app.models.shop import Shop
    from app.models.order import Order, OrderItem
    start, _ = _period_range(period)
    rows = (
        db.query(Shop.shop_name, func.sum(Order.final_price).label("total"))
        .join(Order, Order.shop_id == Shop.shop_id)
        .filter(Order.created_at >= start, Order.order_status == "delivered")
        .group_by(Shop.shop_id, Shop.shop_name)
        .order_by(desc("total"))
        .limit(min(limit, 20))
        .all()
    )
    return {
        "top_shops": [{"shop_name": r.shop_name, "revenue": float(r.total or 0)} for r in rows],
        "period": period,
    }


# ─────────────────────────────────────────────
# USER / BUYER tools
# ─────────────────────────────────────────────

def user_search_products(db: Session, user: Any, query: str | None = None,
                         category_id: int | None = None,
                         min_price: float | None = None, max_price: float | None = None,
                         sort: str = "popular", limit: int = 10) -> dict:
    from app.models.product import Product
    q = db.query(Product).filter(Product.status == "active", Product.stock_quantity > 0)
    if query:
        q = q.filter(Product.product_name.ilike(f"%{query}%"))
    if category_id:
        q = q.filter(Product.category_id == category_id)
    if min_price is not None:
        q = q.filter(Product.price >= min_price)
    if max_price is not None:
        q = q.filter(Product.price <= max_price)
    if sort == "popular":
        q = q.order_by(desc(Product.sales_count))
    elif sort == "cheapest":
        q = q.order_by(Product.price)
    elif sort == "rating":
        q = q.order_by(desc(Product.rating))
    elif sort == "newest":
        q = q.order_by(desc(Product.created_at))
    products = q.limit(min(limit, 20)).all()
    return {
        "products": [
            {"product_id": p.product_id, "product_name": p.product_name,
             "price": float(p.price), "rating": float(p.rating or 0),
             "sales_count": p.sales_count, "stock_quantity": p.stock_quantity}
            for p in products
        ],
        "count": len(products),
    }


def user_get_order_status(db: Session, user: Any, order_id: int | None = None) -> dict:
    from app.models.order import Order
    q = db.query(Order).filter(Order.user_id == user.user_id)
    if order_id:
        q = q.filter(Order.order_id == order_id)
    else:
        q = q.order_by(desc(Order.created_at))
    order = q.first()
    if not order:
        return {"error": "Không tìm thấy đơn hàng"}
    return {
        "order_id": order.order_id,
        "status": order.order_status,
        "total_amount": float(order.final_price or 0),
        "created_at": str(order.created_at),
    }


def user_get_order_history(db: Session, user: Any, limit: int = 10) -> dict:
    from app.models.order import Order
    orders = (
        db.query(Order)
        .filter(Order.user_id == user.user_id)
        .order_by(desc(Order.created_at))
        .limit(min(limit, 30))
        .all()
    )
    return {
        "orders": [
            {"order_id": o.order_id, "status": o.order_status,
             "total_amount": float(o.final_price or 0), "created_at": str(o.created_at)}
            for o in orders
        ],
        "count": len(orders),
    }


def user_get_vouchers(db: Session, user: Any) -> dict:
    from app.models.voucher import Voucher
    now = datetime.datetime.utcnow()
    vouchers = (
        db.query(Voucher)
        .filter(Voucher.is_active == True, Voucher.end_date >= now)
        .order_by(Voucher.end_date)
        .limit(10)
        .all()
    )
    return {
        "vouchers": [
            {"code": v.code, "discount_type": v.discount_type,
             "discount_value": float(v.discount_value or 0),
             "min_order_amount": float(v.min_order_amount or 0),
             "end_date": str(v.end_date)}
            for v in vouchers
        ],
        "count": len(vouchers),
    }


# ─────────────────────────────────────────────
# SHOP tools
# ─────────────────────────────────────────────

def _shop_id_for(db: Session, user: Any) -> int | None:
    from app.models.shop import Shop
    shop = db.query(Shop).filter(Shop.shop_id == user.user_id).first()
    return shop.shop_id if shop else None


def shop_get_stats(db: Session, user: Any, period: str = "month") -> dict:
    from app.models.order import Order
    shop_id = _shop_id_for(db, user)
    if not shop_id:
        return {"error": "Không tìm thấy shop"}
    start, _ = _period_range(period)
    revenue = db.query(func.sum(Order.final_price)).filter(
        Order.shop_id == shop_id, Order.created_at >= start, Order.order_status == "delivered"
    ).scalar() or 0
    order_count = db.query(func.count(Order.order_id)).filter(
        Order.shop_id == shop_id, Order.created_at >= start
    ).scalar() or 0
    pending = db.query(func.count(Order.order_id)).filter(
        Order.shop_id == shop_id, Order.order_status == "pending"
    ).scalar() or 0
    return {
        "period": period, "revenue": float(revenue),
        "order_count": order_count, "pending_orders": pending,
    }


def shop_get_low_stock(db: Session, user: Any, threshold: int = 5) -> dict:
    from app.models.product import Product
    shop_id = _shop_id_for(db, user)
    if not shop_id:
        return {"error": "Không tìm thấy shop"}
    products = (
        db.query(Product)
        .filter(Product.shop_id == shop_id, Product.status == "active",
                Product.stock_quantity <= threshold)
        .order_by(Product.stock_quantity)
        .all()
    )
    return {
        "low_stock_products": [
            {"product_id": p.product_id, "product_name": p.product_name,
             "stock_quantity": p.stock_quantity}
            for p in products
        ],
        "count": len(products),
        "threshold": threshold,
    }


def shop_get_top_products(db: Session, user: Any, metric: str = "sales", period: str = "month", limit: int = 5) -> dict:
    from app.models.product import Product
    shop_id = _shop_id_for(db, user)
    if not shop_id:
        return {"error": "Không tìm thấy shop"}
    q = db.query(Product).filter(Product.shop_id == shop_id, Product.status == "active")
    if metric == "views":
        q = q.order_by(desc(Product.views_count))
    else:
        q = q.order_by(desc(Product.sales_count))
    products = q.limit(min(limit, 20)).all()
    return {
        "top_products": [
            {"product_id": p.product_id, "product_name": p.product_name,
             "sales_count": p.sales_count, "views_count": p.views_count,
             "stock_quantity": p.stock_quantity}
            for p in products
        ],
        "metric": metric,
    }


def shop_get_product_count(db: Session, user: Any) -> dict:
    """Tổng số sản phẩm của shop, chia theo trạng thái (active/approved/pending/rejected/archived)."""
    from app.models.product import Product
    shop_id = _shop_id_for(db, user)
    if not shop_id:
        return {"error": "Không tìm thấy shop"}
    rows = (
        db.query(Product.status, func.count(Product.product_id))
        .filter(Product.shop_id == shop_id, Product.deleted_at.is_(None))
        .group_by(Product.status)
        .all()
    )
    by_status = {status: count for status, count in rows}
    return {
        "total_products": sum(by_status.values()),
        "active":   by_status.get("active", 0),
        "approved": by_status.get("approved", 0),
        "pending":  by_status.get("pending", 0),
        "rejected": by_status.get("rejected", 0),
        "archived": by_status.get("archived", 0),
    }


def shop_get_pending_orders(db: Session, user: Any, limit: int = 10) -> dict:
    from app.models.order import Order
    shop_id = _shop_id_for(db, user)
    if not shop_id:
        return {"error": "Không tìm thấy shop"}
    orders = (
        db.query(Order)
        .filter(Order.shop_id == shop_id, Order.order_status == "pending")
        .order_by(Order.created_at)
        .limit(min(limit, 30))
        .all()
    )
    return {
        "pending_orders": [
            {"order_id": o.order_id, "total_amount": float(o.final_price or 0),
             "created_at": str(o.created_at)}
            for o in orders
        ],
        "count": len(orders),
    }


# ─────────────────────────────────────────────
# SHIPPER tools
# ─────────────────────────────────────────────

def shipper_get_deliveries(db: Session, user: Any, status: str | None = None, limit: int = 10) -> dict:
    from app.models.shipment import Shipment
    q = db.query(Shipment).filter(Shipment.shipper_id == user.user_id)
    if status:
        q = q.filter(Shipment.status == status)
    items = q.order_by(Shipment.created_at).limit(min(limit, 30)).all()
    return {
        "deliveries": [
            {"delivery_id": d.shipment_id, "status": d.status,
             "delivery_address": d.delivery_location,
             "assigned_at": str(d.created_at) if d.created_at else None}
            for d in items
        ],
        "count": len(items),
    }


def shipper_get_earnings(db: Session, user: Any, period: str = "today") -> dict:
    from app.models.shipment import Shipment
    start, _ = _period_range(period)
    # Đếm đơn đã giao trong kỳ
    count = db.query(func.count(Shipment.shipment_id)).filter(
        Shipment.shipper_id == user.user_id,
        Shipment.status == "delivered",
        Shipment.updated_at >= start,
    ).scalar() or 0
    return {"period": period, "delivered_count": count,
            "note": "Thu nhập chi tiết xem tại trang Tài chính shipper"}


def shipper_get_profile(db: Session, user: Any) -> dict:
    from app.models.shipment import Shipper
    profile = db.query(Shipper).filter(Shipper.shipper_id == user.user_id).first()
    if not profile:
        return {"error": "Không tìm thấy hồ sơ shipper"}
    return {
        "vehicle_type": profile.vehicle_type,
        "status": profile.status,
        "shipper_type": profile.shipper_type,
        "zone_province": profile.zone_province,
    }


def shipper_update_delivery(db: Session, user: Any, delivery_id: int, status: str, note: str = "") -> dict:
    from app.models.shipment import Shipment
    # Shipment status flow (simplified for chatbot)
    VALID_STATUSES = {"out_for_delivery", "delivered", "failed"}
    shipment = db.query(Shipment).filter(
        Shipment.shipment_id == delivery_id,
        Shipment.shipper_id == user.user_id,
    ).first()
    if not shipment:
        return {"error": "Không tìm thấy đơn giao hàng này"}
    if status not in VALID_STATUSES:
        return {"error": f"Trạng thái không hợp lệ. Chỉ được: {sorted(VALID_STATUSES)}"}
    shipment.status = status
    if note:
        shipment.failure_reason = note
    shipment.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"success": True, "delivery_id": delivery_id, "new_status": status}


def shipper_get_next_delivery(db: Session, user: Any) -> dict:
    """Lấy đơn giao tiếp theo cần xử lý (được giao nhưng chưa hoàn thành)."""
    from app.models.shipment import Shipment
    shipment = (
        db.query(Shipment)
        .filter(
            Shipment.shipper_id == user.user_id,
            Shipment.status.in_(["assigned_pickup", "at_ward_warehouse", "out_for_delivery"]),
        )
        .order_by(Shipment.created_at)
        .first()
    )
    if not shipment:
        return {"message": "Không có đơn giao hàng nào đang chờ xử lý"}
    return {
        "delivery_id": shipment.shipment_id,
        "status": shipment.status,
        "delivery_address": shipment.delivery_location,
        "delivery_code": shipment.delivery_code,
        "created_at": str(shipment.created_at),
    }


# ─────────────────────────────────────────────
# USER action tools
# ─────────────────────────────────────────────

def user_cancel_order(db: Session, user: Any, order_id: int) -> dict:
    """Hủy đơn hàng (chỉ khi còn ở trạng thái 'pending')."""
    from app.models.order import Order
    order = db.query(Order).filter(
        Order.order_id == order_id,
        Order.user_id == user.user_id,
    ).first()
    if not order:
        return {"error": "Không tìm thấy đơn hàng này hoặc đơn không thuộc về bạn"}
    if order.order_status != "pending":
        return {"error": f"Không thể hủy đơn ở trạng thái '{order.order_status}'. Chỉ hủy được đơn 'pending'."}
    order.order_status = "cancelled"
    order.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"success": True, "order_id": order_id, "message": f"Đơn hàng #{order_id} đã được hủy thành công"}


# ─────────────────────────────────────────────
# SHOP action tools
# ─────────────────────────────────────────────

def shop_get_wallet_balance(db: Session, user: Any) -> dict:
    """Xem số dư ví shop."""
    from app.models.wallet_auction import ShopWallet
    shop_id = _shop_id_for(db, user)
    if not shop_id:
        return {"error": "Không tìm thấy shop"}
    wallet = db.query(ShopWallet).filter(ShopWallet.shop_id == shop_id).first()
    if not wallet:
        return {"error": "Shop chưa có ví. Vui lòng liên hệ Admin."}
    available = float(wallet.balance - wallet.reserved)
    return {
        "balance": float(wallet.balance),
        "reserved": float(wallet.reserved),
        "available": available,
        "note": "Số dư khả dụng = Tổng số dư - Đang giữ (bid đấu giá)",
    }


def shop_confirm_order(db: Session, user: Any, order_id: int) -> dict:
    """Shop xác nhận đơn hàng pending."""
    from app.models.order import Order
    shop_id = _shop_id_for(db, user)
    if not shop_id:
        return {"error": "Không tìm thấy shop"}
    order = db.query(Order).filter(
        Order.order_id == order_id,
        Order.shop_id == shop_id,
    ).first()
    if not order:
        return {"error": "Không tìm thấy đơn hàng trong shop của bạn"}
    if order.order_status != "pending":
        return {"error": f"Đơn hàng đang ở trạng thái '{order.order_status}', không thể xác nhận"}
    order.order_status = "confirmed"
    order.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"success": True, "order_id": order_id, "message": f"Đơn hàng #{order_id} đã xác nhận thành công"}


# ─────────────────────────────────────────────
# ADMIN action tools
# ─────────────────────────────────────────────

def admin_get_pending_shippers(db: Session, user: Any, limit: int = 20) -> dict:
    """Xem danh sách đơn đăng ký shipper chờ duyệt."""
    from app.models.shipment import ShipperRegistration
    from app.models.user import User as UserModel
    rows = (
        db.query(ShipperRegistration, UserModel.full_name)
        .join(UserModel, UserModel.user_id == ShipperRegistration.user_id)
        .filter(ShipperRegistration.status == "pending")
        .order_by(ShipperRegistration.created_at)
        .limit(min(limit, 50))
        .all()
    )
    return {
        "pending_shippers": [
            {
                "reg_id": r.ShipperRegistration.reg_id,
                "user_id": r.ShipperRegistration.user_id,
                "full_name": r.full_name,
                "vehicle_type": r.ShipperRegistration.vehicle_type,
                "created_at": str(r.ShipperRegistration.created_at),
            }
            for r in rows
        ],
        "count": len(rows),
    }


def admin_approve_shop(db: Session, user: Any, reg_id: int, action: str,
                       rejection_reason: str = "") -> dict:
    """Duyệt hoặc từ chối đơn đăng ký mở shop."""
    from app.models.shop import ShopRegistration
    if action not in ("approve", "reject"):
        return {"error": "action phải là 'approve' hoặc 'reject'"}
    reg = db.query(ShopRegistration).filter(ShopRegistration.reg_id == reg_id).first()
    if not reg:
        return {"error": f"Không tìm thấy đơn đăng ký #{reg_id}"}
    if reg.status != "pending":
        return {"error": f"Đơn này đã được xử lý (trạng thái: {reg.status})"}
    reg.status = "approved" if action == "approve" else "rejected"
    reg.reviewed_by = user.user_id
    reg.reviewed_at = datetime.datetime.utcnow()
    if action == "reject" and rejection_reason:
        reg.rejection_reason = rejection_reason
    db.commit()
    action_label = "phê duyệt" if action == "approve" else "từ chối"
    return {
        "success": True,
        "reg_id": reg_id,
        "shop_name": reg.shop_name,
        "new_status": reg.status,
        "message": f"Đã {action_label} đơn đăng ký shop '{reg.shop_name}'",
    }


def admin_resolve_dispute(db: Session, user: Any, dispute_id: int, verdict: str,
                          resolution_details: str = "") -> dict:
    """Giải quyết tranh chấp: resolve (đồng ý khiếu nại) | reject (bác khiếu nại) | escalate."""
    from app.models.dispute import Dispute
    if verdict not in ("resolve", "reject", "escalate"):
        return {"error": "verdict phải là 'resolve', 'reject', hoặc 'escalate'"}
    dispute = db.query(Dispute).filter(Dispute.dispute_id == dispute_id).first()
    if not dispute:
        return {"error": f"Không tìm thấy tranh chấp #{dispute_id}"}
    if dispute.status != "open":
        return {"error": f"Tranh chấp này đã được xử lý (trạng thái: {dispute.status})"}
    status_map = {"resolve": "resolved", "reject": "resolved", "escalate": "escalated"}
    dispute.status = status_map[verdict]
    dispute.resolved_by = user.user_id
    dispute.resolution_details = resolution_details or f"Xử lý bởi admin (verdict={verdict})"
    dispute.resolved_at = datetime.datetime.utcnow()
    db.commit()
    verdict_label = {"resolve": "chấp nhận", "reject": "bác bỏ", "escalate": "leo thang"}[verdict]
    return {
        "success": True,
        "dispute_id": dispute_id,
        "new_status": dispute.status,
        "message": f"Đã {verdict_label} tranh chấp #{dispute_id}",
    }


# ─────────────────────────────────────────────
# DATA QUERY — SQL tự do (an toàn theo role, xem sql_guard.py)
# Dùng khi câu hỏi cần dữ liệu nhưng không khớp tool cố định nào ở trên.
# Mỗi role có 1 wrapper riêng, hardcode sẵn role — KHÔNG lấy role từ tham số
# do Gemini truyền vào, để không ai có thể "đánh lừa" tool tự nhận mình là
# admin.
# ─────────────────────────────────────────────

def admin_query_data(db: Session, user: Any, sql: str) -> dict:
    from sql_guard import run_data_query
    return run_data_query(db, user, "admin", sql)


def user_query_data(db: Session, user: Any, sql: str) -> dict:
    from sql_guard import run_data_query
    return run_data_query(db, user, "user", sql)


def shop_query_data(db: Session, user: Any, sql: str) -> dict:
    from sql_guard import run_data_query
    return run_data_query(db, user, "shop", sql)


def shipper_query_data(db: Session, user: Any, sql: str) -> dict:
    from sql_guard import run_data_query
    return run_data_query(db, user, "shipper", sql)


# ─────────────────────────────────────────────
# Tool dispatcher
# ─────────────────────────────────────────────

TOOL_MAP = {
    # Admin — read
    "admin_query_stats":          admin_query_stats,
    "admin_filter_shops":         admin_filter_shops,
    "admin_filter_orders":        admin_filter_orders,
    "admin_get_disputes":         admin_get_disputes,
    "admin_top_shops":            admin_top_shops,
    "admin_get_pending_shippers": admin_get_pending_shippers,
    # Admin — action
    "admin_approve_shop":         admin_approve_shop,
    "admin_resolve_dispute":      admin_resolve_dispute,
    # User — read
    "user_search_products":       user_search_products,
    "user_get_order_status":      user_get_order_status,
    "user_get_order_history":     user_get_order_history,
    "user_get_vouchers":          user_get_vouchers,
    # User — action
    "user_cancel_order":          user_cancel_order,
    # Shop — read
    "shop_get_stats":             shop_get_stats,
    "shop_get_product_count":     shop_get_product_count,
    "shop_get_low_stock":         shop_get_low_stock,
    "shop_get_top_products":      shop_get_top_products,
    "shop_get_pending_orders":    shop_get_pending_orders,
    "shop_get_wallet_balance":    shop_get_wallet_balance,
    # Shop — action
    "shop_confirm_order":         shop_confirm_order,
    # Shipper — read
    "shipper_get_deliveries":     shipper_get_deliveries,
    "shipper_get_earnings":       shipper_get_earnings,
    "shipper_get_profile":        shipper_get_profile,
    "shipper_get_next_delivery":  shipper_get_next_delivery,
    # Shipper — action
    "shipper_update_delivery":    shipper_update_delivery,
    # Data query — SQL tự do (1 wrapper riêng cho mỗi role)
    "admin_query_data":           admin_query_data,
    "user_query_data":            user_query_data,
    "shop_query_data":            shop_query_data,
    "shipper_query_data":         shipper_query_data,
}


# Tools that write to DB — must never be cached
ACTION_TOOLS = {
    "user_cancel_order",
    "shop_confirm_order",
    "admin_approve_shop",
    "admin_resolve_dispute",
    "shipper_update_delivery",
}


def execute_tool(tool_name: str, tool_input: dict, db: Session, user: Any) -> dict:
    fn = TOOL_MAP.get(tool_name)
    if not fn:
        return {"error": f"Tool '{tool_name}' không tồn tại"}
    try:
        return fn(db=db, user=user, **tool_input)
    except Exception as e:
        return {"error": str(e)}
