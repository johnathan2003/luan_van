"""
Bot tool implementations — DB queries scoped per role.
Each function takes (db, user) and arbitrary kwargs from Claude's tool_use.
Returns a dict that Claude will use to compose the final answer.
"""
from __future__ import annotations
import datetime
from typing import Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc


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
        revenue = db.query(func.sum(Order.total_amount)).filter(
            Order.created_at >= start, Order.status == "delivered"
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
            Shop.status == "active"
        ).scalar() or 0
        result["active_shops"] = active_shops

    result["period"] = period
    return result


def admin_filter_shops(db: Session, user: Any, status: str | None = None,
                       search: str | None = None, limit: int = 20) -> dict:
    from app.models.shop import Shop
    q = db.query(Shop)
    if status:
        q = q.filter(Shop.status == status)
    if search:
        q = q.filter(Shop.shop_name.ilike(f"%{search}%"))
    shops = q.order_by(desc(Shop.created_at)).limit(min(limit, 50)).all()
    return {
        "shops": [
            {"shop_id": s.shop_id, "shop_name": s.shop_name,
             "status": s.status, "rating": float(s.rating or 0)}
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
        q = q.filter(Order.status == status)
    orders = q.order_by(desc(Order.created_at)).limit(min(limit, 50)).all()
    return {
        "orders": [
            {"order_id": o.order_id, "status": o.status,
             "total_amount": float(o.total_amount or 0),
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
        db.query(Shop.shop_name, func.sum(Order.total_amount).label("total"))
        .join(Order, Order.shop_id == Shop.shop_id)
        .filter(Order.created_at >= start, Order.status == "delivered")
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
        "status": order.status,
        "total_amount": float(order.total_amount or 0),
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
            {"order_id": o.order_id, "status": o.status,
             "total_amount": float(o.total_amount or 0), "created_at": str(o.created_at)}
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
    revenue = db.query(func.sum(Order.total_amount)).filter(
        Order.shop_id == shop_id, Order.created_at >= start, Order.status == "delivered"
    ).scalar() or 0
    order_count = db.query(func.count(Order.order_id)).filter(
        Order.shop_id == shop_id, Order.created_at >= start
    ).scalar() or 0
    pending = db.query(func.count(Order.order_id)).filter(
        Order.shop_id == shop_id, Order.status == "pending"
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


def shop_get_pending_orders(db: Session, user: Any, limit: int = 10) -> dict:
    from app.models.order import Order
    shop_id = _shop_id_for(db, user)
    if not shop_id:
        return {"error": "Không tìm thấy shop"}
    orders = (
        db.query(Order)
        .filter(Order.shop_id == shop_id, Order.status == "pending")
        .order_by(Order.created_at)
        .limit(min(limit, 30))
        .all()
    )
    return {
        "pending_orders": [
            {"order_id": o.order_id, "total_amount": float(o.total_amount or 0),
             "created_at": str(o.created_at)}
            for o in orders
        ],
        "count": len(orders),
    }


# ─────────────────────────────────────────────
# SHIPPER tools
# ─────────────────────────────────────────────

def shipper_get_deliveries(db: Session, user: Any, status: str | None = None, limit: int = 10) -> dict:
    from app.models.shipment import Delivery
    q = db.query(Delivery).filter(Delivery.shipper_id == user.user_id)
    if status:
        q = q.filter(Delivery.status == status)
    deliveries = q.order_by(Delivery.assigned_at).limit(min(limit, 30)).all()
    return {
        "deliveries": [
            {"delivery_id": d.delivery_id, "status": d.status,
             "delivery_address": d.delivery_address,
             "assigned_at": str(d.assigned_at) if d.assigned_at else None}
            for d in deliveries
        ],
        "count": len(deliveries),
    }


def shipper_get_earnings(db: Session, user: Any, period: str = "today") -> dict:
    from app.models.shipment import Delivery
    start, _ = _period_range(period)
    total = db.query(func.sum(Delivery.shipper_earn)).filter(
        Delivery.shipper_id == user.user_id,
        Delivery.status == "delivered",
        Delivery.updated_at >= start,
    ).scalar() or 0
    count = db.query(func.count(Delivery.delivery_id)).filter(
        Delivery.shipper_id == user.user_id,
        Delivery.status == "delivered",
        Delivery.updated_at >= start,
    ).scalar() or 0
    return {"period": period, "total_earn": float(total), "delivered_count": count}


def shipper_get_profile(db: Session, user: Any) -> dict:
    from app.models.shipment import Shipper
    profile = db.query(Shipper).filter(Shipper.shipper_id == user.user_id).first()
    if not profile:
        return {"error": "Không tìm thấy hồ sơ shipper"}
    return {
        "rating": float(profile.rating or 0),
        "total_deliveries": profile.total_deliveries or 0,
        "total_earned": float(profile.total_earned or 0),
        "status": profile.status,
    }


def shipper_update_delivery(db: Session, user: Any, delivery_id: int, status: str, note: str = "") -> dict:
    from app.models.shipment import Delivery
    VALID_TRANSITIONS = {
        "assigned": ["picking_up"],
        "picking_up": ["picked_up"],
        "picked_up": ["in_transit"],
        "in_transit": ["delivered", "failed"],
    }
    delivery = db.query(Delivery).filter(
        Delivery.delivery_id == delivery_id,
        Delivery.shipper_id == user.user_id,
    ).first()
    if not delivery:
        return {"error": "Không tìm thấy đơn giao hàng này"}
    allowed = VALID_TRANSITIONS.get(delivery.status, [])
    if status not in allowed:
        return {"error": f"Không thể chuyển từ '{delivery.status}' sang '{status}'. Trạng thái hợp lệ: {allowed}"}
    delivery.status = status
    if note:
        delivery.note = note
    delivery.updated_at = datetime.datetime.utcnow()
    db.commit()
    return {"success": True, "delivery_id": delivery_id, "new_status": status}


# ─────────────────────────────────────────────
# Tool dispatcher
# ─────────────────────────────────────────────

TOOL_MAP = {
    # Admin
    "admin_query_stats":   admin_query_stats,
    "admin_filter_shops":  admin_filter_shops,
    "admin_filter_orders": admin_filter_orders,
    "admin_get_disputes":  admin_get_disputes,
    "admin_top_shops":     admin_top_shops,
    # User
    "user_search_products":  user_search_products,
    "user_get_order_status": user_get_order_status,
    "user_get_order_history": user_get_order_history,
    "user_get_vouchers":     user_get_vouchers,
    # Shop
    "shop_get_stats":         shop_get_stats,
    "shop_get_low_stock":     shop_get_low_stock,
    "shop_get_top_products":  shop_get_top_products,
    "shop_get_pending_orders": shop_get_pending_orders,
    # Shipper
    "shipper_get_deliveries":     shipper_get_deliveries,
    "shipper_get_earnings":       shipper_get_earnings,
    "shipper_get_profile":        shipper_get_profile,
    "shipper_update_delivery":    shipper_update_delivery,
}


def execute_tool(tool_name: str, tool_input: dict, db: Session, user: Any) -> dict:
    fn = TOOL_MAP.get(tool_name)
    if not fn:
        return {"error": f"Tool '{tool_name}' không tồn tại"}
    try:
        return fn(db=db, user=user, **tool_input)
    except Exception as e:
        return {"error": str(e)}
