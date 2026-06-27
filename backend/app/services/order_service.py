from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.order import Order, OrderItem
from app.models.product import Product, StockReservation
from app.models.shipment import Shipment
from app.models.payment import Payment
from app.models.voucher import Voucher
from app.schemas.order import OrderCreate
from app.utils.helpers import paginate
from app.utils.formatters import format_order_id


def create_order(db: Session, user_id: int, data: OrderCreate) -> Order:
    if not data.items:
        raise HTTPException(status_code=400, detail="Order must have at least one item")

    total_price = 0.0
    order_items_data = []
    shop_id = None

    for item_data in data.items:
        product = db.query(Product).filter(
            Product.product_id == item_data.product_id,
            Product.status == "active",
            Product.deleted_at.is_(None),
        ).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item_data.product_id} not found or unavailable")
        if product.stock_quantity < item_data.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for '{product.product_name}'")

        price = float(product.price)
        total_price += price * item_data.quantity
        order_items_data.append((product, item_data.quantity, price))

        if shop_id is None:
            shop_id = product.shop_id

    # Voucher discount
    discount = 0.0
    if data.voucher_code:
        voucher = db.query(Voucher).filter(
            Voucher.code == data.voucher_code,
            Voucher.status == "active",
        ).first()
        if voucher:
            min_val = float(voucher.min_order_value or 0)
            if total_price >= min_val:
                if voucher.discount_type == "percentage":
                    discount = total_price * float(voucher.discount_value) / 100
                    max_disc = float(voucher.max_discount or 9999999)
                    discount = min(discount, max_disc)
                else:
                    discount = float(voucher.discount_value)
                voucher.current_uses += 1

    final_price = max(0.0, total_price - discount)

    # COD: payment_status bắt đầu là "unpaid" (thanh toán khi nhận)
    # Online: "unpaid" chờ gateway xác nhận
    is_cod = data.payment_method == "cod"

    order = Order(
        user_id=user_id,
        shop_id=shop_id,
        total_price=total_price,
        discount_amount=discount,
        final_price=final_price,
        payment_method=data.payment_method,
        payment_status="unpaid",
        order_status="pending",
        shipping_address=data.shipping_address,
        recipient_name=data.recipient_name,
        recipient_phone=data.recipient_phone,
        notes=data.note,
        voucher_code=data.voucher_code,
    )
    db.add(order)
    db.flush()  # → order.order_id sẵn sàng

    # ── Sinh mã đơn hàng ──────────────────────────────────────────────────────
    order.order_number = format_order_id(order.order_id)  # VD: ORD00000007

    for product, quantity, price in order_items_data:
        db.add(OrderItem(
            order_id=order.order_id,
            product_id=product.product_id,
            quantity=quantity,
            price_at_order=str(price),
            product_name=product.product_name,
            product_image=product.image_urls[0] if product.image_urls else None,
        ))
        product.stock_quantity -= quantity
        product.sales_count += quantity

    # ── Payment record ─────────────────────────────────────────────────────────
    db.add(Payment(
        order_id=order.order_id,
        amount=str(final_price),
        method=data.payment_method,
        status="pending",
    ))

    # ── Shipment record ────────────────────────────────────────────────────────
    db.add(Shipment(order_id=order.order_id))

    db.commit()
    db.refresh(order)

    # ── Notify nhân viên shop về đơn hàng mới ─────────────────────────────────
    try:
        from app.models.shop import ShopEmployee, EmployeeRolePermission
        from app.services.notification_service import create_notification

        # Chỉ notify nhân viên có quyền xử lý đơn (order:read hoặc order:confirm)
        ORDER_PERMS = {"order:read", "order:confirm"}
        all_employees = db.query(ShopEmployee).filter(
            ShopEmployee.shop_id == shop_id,
            ShopEmployee.status == "active",
        ).all()
        employees = [
            emp for emp in all_employees
            if any(p.permission_code in ORDER_PERMS for p in emp.permissions)
        ]

        # Cũng notify shop owner (shop_id == user_id của chủ shop)
        owner_ids_notified = {emp.user_id for emp in employees}
        notify_targets = list(employees)  # sẽ dùng user_id bên dưới

        method_label = "COD (tiền mặt)" if is_cod else "Online"

        # Notify chủ shop
        create_notification(
            db=db,
            user_id=shop_id,           # chủ shop: shop_id == user_id
            title="🛍️ Đơn hàng mới",
            message=f"Đơn {order.order_number} — {int(final_price):,}₫ — {method_label}. Vui lòng xác nhận.",
            notif_type="order",
            related_entity_type="order",
            related_entity_id=order.order_id,
            action_url="/shop/orders",
        )

        # Notify nhân viên có quyền order
        for emp in notify_targets:
            if emp.user_id == shop_id:
                continue  # tránh notify trùng nếu chủ shop cũng là nhân viên
            create_notification(
                db=db,
                user_id=emp.user_id,
                title="🛍️ Đơn hàng mới",
                message=f"Đơn {order.order_number} — {int(final_price):,}₫ — {method_label}. Vui lòng xác nhận.",
                notif_type="order",
                related_entity_type="order",
                related_entity_id=order.order_id,
                action_url="/employee/orders",
            )
    except Exception:
        pass  # notification fail không block tạo đơn

    return order


def get_user_orders(db: Session, user_id: int, page: int = 1, limit: int = 10, order_status: str = None):
    query = db.query(Order).filter(Order.user_id == user_id).order_by(Order.created_at.desc())
    if order_status:
        query = query.filter(Order.order_status == order_status)
    return paginate(query, page, limit)


def get_shop_orders(db: Session, shop_id: int, page: int = 1, limit: int = 10, order_status: str = None):
    query = db.query(Order).filter(Order.shop_id == shop_id).order_by(Order.created_at.desc())
    if order_status:
        query = query.filter(Order.order_status == order_status)
    return paginate(query, page, limit)


def get_order_by_id(db: Session, order_id: int) -> Order:
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


def confirm_order(db: Session, order_id: int, confirmed_by: int) -> Order:
    order = get_order_by_id(db, order_id)
    if order.order_status != "pending":
        raise HTTPException(status_code=400, detail="Order cannot be confirmed in current status")
    order.order_status = "confirmed"
    order.confirmed_by = confirmed_by
    order.confirmed_at = datetime.utcnow()
    if order.payment:
        if order.payment_method == "cod":
            order.payment_status = "unpaid"
    db.commit()
    db.refresh(order)
    return order


def mark_ready_to_ship(db: Session, order_id: int, prepared_by: int) -> Order:
    order = get_order_by_id(db, order_id)
    if order.order_status != "confirmed":
        raise HTTPException(status_code=400, detail="Order must be confirmed first")
    order.order_status = "ready_to_ship"
    order.prepared_by = prepared_by
    order.prepared_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return order


def cancel_order(db: Session, order_id: int, user_id: int) -> Order:
    order = get_order_by_id(db, order_id)
    if order.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not your order")
    if order.order_status not in ("pending", "confirmed"):
        raise HTTPException(status_code=400, detail="Cannot cancel order in current status")

    # Restore stock
    for item in order.items:
        product = db.query(Product).filter(Product.product_id == item.product_id).first()
        if product:
            product.stock_quantity += item.quantity
            product.sales_count -= item.quantity

    order.order_status = "cancelled"
    db.commit()
    db.refresh(order)
    return order


def confirm_received(db: Session, order_id: int, user_id: int) -> Order:
    order = get_order_by_id(db, order_id)
    if order.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not your order")
    if order.order_status != "delivered":
        raise HTTPException(status_code=400, detail="Order must be delivered first")
    order.order_status = "completed"
    if order.payment and order.payment_method == "cod":
        order.payment.status = "success"
        order.payment_status = "paid"
    db.commit()
    db.refresh(order)
    return order
