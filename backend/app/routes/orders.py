from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.order import OrderCreate
from app.services.order_service import (
    create_order, get_user_orders, get_order_by_id,
    confirm_order, mark_ready_to_ship, cancel_order, confirm_received,
)
from app.services.notification_service import create_notification

router = APIRouter()


@router.post("", status_code=201)
def place_order(
    data: OrderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = create_order(db, current_user.user_id, data)

    # Notify shop
    if order.shop_id:
        create_notification(
            db, order.shop_id,
            "Đơn hàng mới",
            f"Bạn có đơn hàng mới #{order.order_id}",
            "new_order", "order", order.order_id,
        )

    result = {"message": "Order created", "order_id": order.order_id, "status": order.order_status, "final_price": order.final_price}

    if data.payment_method == "momo":
        from app.services.payment_service import create_momo_payment
        try:
            momo = create_momo_payment(db, order.order_id, int(float(order.final_price)))
            result["payment_url"] = momo.get("payUrl")
        except Exception:
            pass
    elif data.payment_method == "vnpay":
        from app.services.payment_service import create_vnpay_url
        result["payment_url"] = create_vnpay_url(order.order_id, int(float(order.final_price)))

    return result


@router.get("/me")
def get_my_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    order_status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items, total, pages = get_user_orders(db, current_user.user_id, page, limit, order_status)
    return {
        "orders": [
            {
                "order_id": o.order_id,
                "total_price": o.total_price,
                "final_price": o.final_price,
                "payment_method": o.payment_method,
                "payment_status": o.payment_status,
                "order_status": o.order_status,
                "created_at": str(o.created_at),
                "items": [
                    {"product_name": i.product_name, "quantity": i.quantity, "price": i.price_at_order}
                    for i in o.items
                ],
            }
            for o in items
        ],
        "total": total,
        "page": page,
        "pages": pages,
    }


@router.get("/{order_id}")
def get_order(order_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = get_order_by_id(db, order_id)
    return {
        "order_id": order.order_id,
        "user_id": order.user_id,
        "shop_id": order.shop_id,
        "shipper_id": order.shipper_id,
        "total_price": order.total_price,
        "discount": order.discount,
        "final_price": order.final_price,
        "payment_method": order.payment_method,
        "payment_status": order.payment_status,
        "order_status": order.order_status,
        "shipping_address": order.shipping_address,
        "recipient_name": order.recipient_name,
        "recipient_phone": order.recipient_phone,
        "note": order.note,
        "created_at": str(order.created_at),
        "items": [
            {
                "product_id": i.product_id,
                "product_name": i.product_name,
                "product_image": i.product_image,
                "quantity": i.quantity,
                "price_at_order": i.price_at_order,
            }
            for i in order.items
        ],
        "shipment": {
            "shipment_id": order.shipment.shipment_id,
            "status": order.shipment.status,
            "current_location": order.shipment.current_location,
        } if order.shipment else None,
    }


@router.put("/{order_id}/cancel")
def cancel(order_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = cancel_order(db, order_id, current_user.user_id)
    return {"message": "Order cancelled", "order_id": order.order_id, "status": order.order_status}


@router.post("/{order_id}/confirm")
def confirm(order_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = confirm_order(db, order_id, current_user.user_id)
    create_notification(db, order.user_id, "Đơn hàng được xác nhận", f"Đơn hàng #{order_id} đã được xác nhận", "order_confirmed", "order", order_id)
    return {"message": "Order confirmed", "order_id": order.order_id, "status": order.order_status}


@router.post("/{order_id}/ready-to-ship")
def ready_to_ship(order_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = mark_ready_to_ship(db, order_id, current_user.user_id)
    return {"message": "Order ready to ship", "order_id": order.order_id, "status": order.order_status}


@router.post("/{order_id}/confirm-received")
def confirm_received_route(order_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = confirm_received(db, order_id, current_user.user_id)
    return {"message": "Order completed", "order_id": order.order_id, "status": order.order_status}


@router.get("/{order_id}/tracking")
def track_order(order_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = get_order_by_id(db, order_id)
    return {
        "order_id": order.order_id,
        "order_status": order.order_status,
        "shipment": {
            "shipment_id": order.shipment.shipment_id,
            "status": order.shipment.status,
            "shipper_id": order.shipment.shipper_id,
            "current_location": order.shipment.current_location,
            "pickup_time": str(order.shipment.pickup_time) if order.shipment.pickup_time else None,
            "delivery_time": str(order.shipment.delivery_time) if order.shipment.delivery_time else None,
        } if order.shipment else None,
    }
