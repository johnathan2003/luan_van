"""
backend/app/routes/employee.py
---------------------------------
Router cho nhân viên shop — chỉ xem/thao tác trong phạm vi quyền được cấp.
Shop_id lấy từ bảng ShopEmployee (không phải user_id).
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User, UserRole
from app.models.shop import ShopEmployee, Shop, EmployeeRolePermission
from app.models.order import Order, OrderItem
from app.models.product import Product

router = APIRouter()


# ─── Dependency: lấy employee record + danh sách permissions ──────────────────

def get_current_employee(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Trả về {'user': User, 'employee': ShopEmployee, 'permissions': set[str], 'shop_id': int}"""
    # Phải có role "employee"
    user_roles = {ur.role.role_name for ur in current_user.user_roles if ur.status == "active"}
    if "employee" not in user_roles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Chỉ dành cho nhân viên shop")

    emp = db.query(ShopEmployee).filter(
        ShopEmployee.user_id == current_user.user_id,
        ShopEmployee.status == "active",
    ).first()
    if not emp:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Tài khoản nhân viên chưa được liên kết với shop")

    perms = {p.permission_code for p in emp.permissions}
    return {
        "user":        current_user,
        "employee":    emp,
        "permissions": perms,
        "shop_id":     emp.shop_id,
    }


def require_perm(perm_code: str):
    """Dependency factory — bảo vệ endpoint theo permission code."""
    def _check(ctx: dict = Depends(get_current_employee)) -> dict:
        if perm_code not in ctx["permissions"]:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Thiếu quyền: {perm_code}")
        return ctx
    return _check


# ─── Profile ──────────────────────────────────────────────────────────────────

@router.get("/me")
def employee_me(ctx: dict = Depends(get_current_employee), db: Session = Depends(get_db)):
    """Thông tin nhân viên + shop + danh sách quyền."""
    emp: ShopEmployee = ctx["employee"]
    shop = db.query(Shop).filter(Shop.shop_id == emp.shop_id).first()
    return {
        "employee_id":   emp.employee_id,
        "user_id":       ctx["user"].user_id,
        "email":         ctx["user"].email,
        "full_name":     ctx["user"].full_name,
        "position":      emp.position,
        "hired_date":    emp.hired_date.isoformat() if emp.hired_date else None,
        "shop_id":       emp.shop_id,
        "shop_name":     shop.shop_name if shop else None,
        "permissions":   sorted(ctx["permissions"]),
    }


# ─── Orders ───────────────────────────────────────────────────────────────────

# Luồng hợp lệ mà nhân viên được phép chuyển
# pending → confirmed (xác nhận nhận đơn)
# confirmed → ready_to_ship (đóng hàng xong — hệ thống auto-assign shipper)
# NOTE: ready_to_ship → shipped do SHIPPER xác nhận lấy hàng, không phải nhân viên
ALLOWED_TRANSITIONS: dict[str, str] = {
    "pending":   "confirmed",
    "confirmed": "ready_to_ship",
}

def _order_row(o: Order) -> dict:
    return {
        "order_id":       o.order_id,
        "order_number":   o.order_number,
        "user_id":        o.user_id,
        "order_status":   o.order_status,
        "payment_method": o.payment_method,
        "payment_status": getattr(o, "payment_status", None),
        "total_amount":   float(o.final_price or o.total_price or 0),
        "shipper_id":     o.shipper_id,
        "created_at":     o.created_at.isoformat() if o.created_at else None,
    }


@router.get("/orders/summary")
def employee_orders_summary(
    ctx: dict     = Depends(require_perm("order:read")),
    db:  Session  = Depends(get_db),
):
    """Số lượng đơn theo 3 trạng thái cần theo dõi."""
    shop_id = ctx["shop_id"]
    result = {}
    for st in ("pending", "confirmed", "ready_to_ship"):
        result[st] = db.query(Order).filter(
            Order.shop_id      == shop_id,
            Order.order_status == st,
        ).count()
    return result


@router.get("/orders")
def employee_orders(
    page:         int          = Query(1, ge=1),
    limit:        int          = Query(50, ge=1, le=100),
    order_status: Optional[str] = None,
    ctx:          dict         = Depends(require_perm("order:read")),
    db:           Session      = Depends(get_db),
):
    """Xem đơn hàng của shop mình làm việc."""
    q = db.query(Order).filter(Order.shop_id == ctx["shop_id"])
    if order_status:
        q = q.filter(Order.order_status == order_status)
    total = q.count()
    rows  = q.order_by(Order.created_at.asc()).offset((page - 1) * limit).limit(limit).all()
    return {"orders": [_order_row(o) for o in rows], "total": total, "page": page}


@router.get("/orders/{order_id}/detail")
def employee_order_detail(
    order_id: int,
    ctx: dict    = Depends(require_perm("order:read")),
    db:  Session = Depends(get_db),
):
    """Chi tiết đơn hàng — kèm sản phẩm, shipper, địa chỉ lấy/giao."""
    from app.models.shipment import Shipment, Shipper
    order = db.query(Order).filter(
        Order.order_id == order_id,
        Order.shop_id  == ctx["shop_id"],
    ).first()
    if not order:
        raise HTTPException(404, "Không tìm thấy đơn hàng")

    shipment = db.query(Shipment).filter(Shipment.order_id == order_id).first()
    shipper_info = None
    if shipment and shipment.shipper_id:
        sh = db.query(Shipper).filter(Shipper.shipper_id == shipment.shipper_id).first()
        if sh and sh.user:
            shipper_info = {
                "shipper_id":    sh.shipper_id,
                "name":          sh.user.full_name or f"Shipper #{sh.shipper_id}",
                "phone":         sh.user.phone,
                "vehicle_type":  sh.vehicle_type,
                "license_plate": sh.license_plate,
                "rating":        str(sh.rating or "0.00"),
            }

    shop = db.query(Shop).filter(Shop.shop_id == ctx["shop_id"]).first()

    return {
        **_order_row(order),
        "order_number":   order.order_number,
        "recipient_name":  order.recipient_name,
        "recipient_phone": order.recipient_phone,
        "shipping_address": order.shipping_address,
        "notes":           order.notes,
        "items": [
            {
                "product_name":  i.product_name,
                "product_image": i.product_image,
                "quantity":      i.quantity,
                "price_at_order": str(i.price_at_order),
            }
            for i in order.items
        ],
        "shipment": {
            "shipment_id":       shipment.shipment_id,
            "status":            shipment.status,
            "pickup_location":   shipment.pickup_location or (shop.address if shop else None),
            "delivery_location": shipment.delivery_location or order.shipping_address,
            "shipper_info":      shipper_info,
        } if shipment else None,
    }


@router.patch("/orders/{order_id}/status")
def employee_update_order_status(
    order_id: int,
    data:     dict,
    ctx:      dict    = Depends(require_perm("order:read")),
    db:       Session = Depends(get_db),
):
    """Chuyển trạng thái đơn theo luồng: pending→confirmed→ready_to_ship.
    Khi chuyển sang ready_to_ship: hệ thống tự chọn shipper ngẫu nhiên và tạo shipment.
    """
    from app.models.shipment import Shipment, Shipper
    from app.services.notification_service import create_notification

    new_status = data.get("order_status", "")

    order = db.query(Order).filter(
        Order.order_id == order_id,
        Order.shop_id  == ctx["shop_id"],
    ).first()
    if not order:
        raise HTTPException(404, "Không tìm thấy đơn hàng")

    # Kiểm tra luồng hợp lệ
    expected_next = ALLOWED_TRANSITIONS.get(order.order_status)
    if expected_next is None:
        raise HTTPException(400, f"Đơn đang ở '{order.order_status}', không thể chuyển tiếp")
    if new_status != expected_next:
        raise HTTPException(400, f"Bước tiếp theo phải là '{expected_next}', không phải '{new_status}'")

    order.order_status = new_status

    shipper_assigned = False
    shipper_id = None
    shipment_id = None

    # ── Auto-assign shipper khi đóng hàng xong ────────────────────────────────
    if new_status == "ready_to_ship":
        # Lấy shop address để điền pickup_location
        shop = db.query(Shop).filter(Shop.shop_id == ctx["shop_id"]).first()
        pickup_loc = shop.address if shop else f"Shop #{ctx['shop_id']}"

        # Tìm shipper random đang available
        shipper = (
            db.query(Shipper)
            .filter(Shipper.status == "available")
            .order_by(func.random())
            .first()
        )

        if shipper:
            # Tạo hoặc cập nhật Shipment
            shipment = db.query(Shipment).filter(Shipment.order_id == order_id).first()
            if not shipment:
                shipment = Shipment(
                    order_id=order_id,
                    shipper_id=shipper.shipper_id,
                    pickup_location=pickup_loc,
                    delivery_location=order.shipping_address or "Địa chỉ khách hàng",
                    status="assigned",
                )
                db.add(shipment)
            else:
                shipment.shipper_id = shipper.shipper_id
                shipment.pickup_location = pickup_loc
                shipment.delivery_location = order.shipping_address or "Địa chỉ khách hàng"
                shipment.status = "assigned"

            # Cập nhật Order + Shipper
            order.shipper_id = shipper.shipper_id
            shipper.status = "on_delivery"

            db.flush()  # để lấy shipment_id
            shipment_id = shipment.shipment_id

            # Gửi thông báo cho shipper (kèm chi tiết đơn)
            try:
                items_summary = ", ".join(
                    f"{i.product_name} x{i.quantity}" for i in order.items
                ) if order.items else "—"
                create_notification(
                    db=db,
                    user_id=shipper.shipper_id,
                    title="📦 Đơn hàng mới cần lấy",
                    message=(
                        f"Đơn {order.order_number} · {items_summary}\n"
                        f"📦 Lấy tại: {pickup_loc}\n"
                        f"📍 Giao đến: {order.shipping_address or '?'} ({order.recipient_name or ''} - {order.recipient_phone or ''})"
                    ),
                    notif_type="order",
                    related_entity_type="order",
                    related_entity_id=order_id,
                    action_url="/shipper/deliveries",
                )
            except Exception:
                pass  # notification fail không block flow

            shipper_assigned = True
            shipper_id = shipper.shipper_id

    db.commit()

    # ── Notify khách hàng về thay đổi trạng thái đơn ─────────────────────────
    try:
        _CUSTOMER_MSG = {
            "confirmed": (
                "✅ Đơn hàng đã được xác nhận",
                f"Shop đã xác nhận đơn {order.order_number}. Chúng tôi đang chuẩn bị hàng cho bạn.",
            ),
            "ready_to_ship": (
                "📦 Hàng đã được đóng gói xong",
                f"Đơn {order.order_number} đã được đóng gói và đang chờ shipper tới lấy.",
            ),
        }
        if new_status in _CUSTOMER_MSG:
            title, message = _CUSTOMER_MSG[new_status]
            create_notification(
                db=db,
                user_id=order.user_id,
                title=title,
                message=message,
                notif_type="order",
                related_entity_type="order",
                related_entity_id=order_id,
                action_url=f"/orders/{order_id}",
            )
    except Exception:
        pass

    return {
        "message": f"Đã cập nhật → {new_status}",
        "order_id": order_id,
        "order_status": new_status,
        "shipper_assigned": shipper_assigned,
        "shipper_id": shipper_id,
        "shipment_id": shipment_id,
    }


# ─── Products ─────────────────────────────────────────────────────────────────

@router.get("/products")
def employee_products(
    page:  int           = Query(1, ge=1),
    limit: int           = Query(20, ge=1, le=100),
    ctx:   dict          = Depends(require_perm("product:update")),   # xem cần ít nhất update
    db:    Session       = Depends(get_db),
):
    """Xem sản phẩm của shop mình."""
    q = db.query(Product).filter(
        Product.shop_id == ctx["shop_id"],
        Product.deleted_at.is_(None),
    )
    total = q.count()
    products = q.order_by(Product.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "products": [
            {
                "product_id":     p.product_id,
                "product_name":   p.product_name,
                "price":          float(p.price) if p.price else 0,
                "stock_quantity": p.stock_quantity,
                "status":         p.status,
                "image_urls":     p.image_urls,
            }
            for p in products
        ],
        "total": total,
        "page":  page,
    }


@router.patch("/products/{product_id}")
def employee_update_product(
    product_id: int,
    data:       dict,
    ctx:        dict    = Depends(require_perm("product:update")),
    db:         Session = Depends(get_db),
):
    p = db.query(Product).filter(
        Product.product_id == product_id,
        Product.shop_id    == ctx["shop_id"],
        Product.deleted_at.is_(None),
    ).first()
    if not p:
        raise HTTPException(404, "Không tìm thấy sản phẩm")
    allowed = {"product_name", "description", "stock_quantity", "price"}
    for k, v in data.items():
        if k in allowed:
            setattr(p, k, str(v) if k == "price" else v)
    db.commit()
    return {"message": "Đã cập nhật sản phẩm", "product_id": product_id}
