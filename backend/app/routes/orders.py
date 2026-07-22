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
                    {"product_name": i.product_name, "quantity": i.quantity, "price_at_order": str(i.price_at_order) if i.price_at_order else "0"}
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
    from app.models.shop import Shop
    order = get_order_by_id(db, order_id)

    # Shipper info
    shipper_info = None
    if order.shipper_id and order.shipment and order.shipment.shipper:
        sh = order.shipment.shipper
        shipper_info = {
            "shipper_id":    sh.shipper_id,
            "name":          sh.user.full_name if sh.user else f"Shipper #{sh.shipper_id}",
            "phone":         sh.user.phone if sh.user else None,
            "vehicle_type":  sh.vehicle_type,
            "license_plate": sh.license_plate,
            "rating":        str(sh.rating or "0.00"),
        }

    # Shop info (pickup location)
    shop = db.query(Shop).filter(Shop.shop_id == order.shop_id).first()

    return {
        "order_id":       order.order_id,
        "order_number":   order.order_number,
        "user_id":        order.user_id,
        "shop_id":        order.shop_id,
        "shop_name":      shop.shop_name if shop else None,
        "shop_address":   shop.address if shop else None,
        "shipper_id":     order.shipper_id,
        "shipper_info":   shipper_info,
        "total_price":    str(order.total_price or 0),
        "discount":       str(order.discount_amount or 0),
        "final_price":    str(order.final_price or 0),
        "payment_method": order.payment_method,
        "payment_status": order.payment_status,
        "order_status":   order.order_status,
        "shipping_address":  order.shipping_address,
        "recipient_name":    order.recipient_name,
        "recipient_phone":   order.recipient_phone,
        "note":           order.notes,
        "created_at":     str(order.created_at),
        "items": [
            {
                "order_item_id": i.order_item_id,
                "product_id":    i.product_id,
                "product_name":  i.product_name,
                "product_image": i.product_image,
                "quantity":      i.quantity,
                "price_at_order": str(i.price_at_order),
            }
            for i in order.items
        ],
        "shipment": {
            "shipment_id":       order.shipment.shipment_id,
            "status":            order.shipment.status,
            "pickup_location":   order.shipment.pickup_location,
            "delivery_location": order.shipment.delivery_location,
            "current_location":  order.shipment.current_location,
            "shipper_id":        order.shipment.shipper_id,
        } if order.shipment else None,
    }


@router.put("/{order_id}/cancel")
def cancel(order_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = cancel_order(db, order_id, current_user.user_id)
    return {"message": "Order cancelled", "order_id": order.order_id, "status": order.order_status}


@router.post("/{order_id}/confirm")
def confirm(order_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = confirm_order(db, order_id, current_user.user_id)
    create_notification(
        db, order.user_id,
        title="✅ Đơn hàng đã được xác nhận",
        message=f"Shop đã xác nhận đơn {order.order_number or f'#{order_id}'}. Chúng tôi đang chuẩn bị hàng cho bạn.",
        notif_type="order_confirmed",
        related_entity_type="order",
        related_entity_id=order_id,
        action_url=f"/orders/{order_id}",
    )
    return {"message": "Order confirmed", "order_id": order.order_id, "status": order.order_status}


@router.post("/{order_id}/ready-to-ship")
def ready_to_ship(order_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from sqlalchemy import func as sqlfunc
    from app.models.shipment import Shipment, Shipper
    from app.models.shop import Shop

    order = mark_ready_to_ship(db, order_id, current_user.user_id)

    # Auto-assign shipper (giống employee endpoint)
    shop = db.query(Shop).filter(Shop.shop_id == order.shop_id).first()
    pickup_loc = shop.address if shop else f"Shop #{order.shop_id}"
    shipper = (
        db.query(Shipper)
        .filter(Shipper.status == "available")
        .order_by(sqlfunc.random())
        .first()
    )
    shipper_assigned = False
    if shipper:
        shipment = db.query(Shipment).filter(Shipment.order_id == order_id).first()
        if not shipment:
            shipment = Shipment(
                order_id=order_id, shipper_id=shipper.shipper_id,
                pickup_location=pickup_loc,
                delivery_location=order.shipping_address or "",
                status="assigned",
            )
            db.add(shipment)
        else:
            shipment.shipper_id = shipper.shipper_id
            shipment.pickup_location = pickup_loc
            shipment.delivery_location = order.shipping_address or ""
            shipment.status = "assigned"
        order.shipper_id = shipper.shipper_id
        shipper.status = "on_delivery"
        db.commit()
        shipper_assigned = True
        try:
            items_summary = ", ".join(f"{i.product_name} x{i.quantity}" for i in order.items)
            create_notification(
                db, shipper.shipper_id,
                title="📦 Đơn hàng mới cần lấy",
                message=f"Đơn {order.order_number} · {items_summary}\n📦 Lấy tại: {pickup_loc}\n📍 Giao đến: {order.shipping_address} ({order.recipient_name} - {order.recipient_phone})",
                notif_type="order",
                related_entity_type="order",
                related_entity_id=order_id,
                action_url="/shipper/deliveries",
            )
        except Exception:
            pass

    # Notify customer
    try:
        create_notification(
            db, order.user_id,
            title="📦 Hàng đã được đóng gói xong",
            message=f"Đơn {order.order_number or f'#{order_id}'} đã được đóng gói và đang chờ shipper tới lấy.",
            notif_type="order",
            related_entity_type="order",
            related_entity_id=order_id,
            action_url=f"/orders/{order_id}",
        )
    except Exception:
        pass

    return {
        "message": "Order ready to ship",
        "order_id": order.order_id,
        "status": order.order_status,
        "shipper_assigned": shipper_assigned,
    }


@router.post("/{order_id}/confirm-packing")
def confirm_packing(
    order_id: int,
    data: dict = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Shop xác nhận đóng gói → sinh mã SD + tạo/cập nhật Shipment → trả delivery_code.
    Bắt buộc phải gọi trước khi shipper đến lấy hàng.
    """
    from fastapi import HTTPException
    from datetime import datetime, timezone
    import random, string
    from app.models.order import Order
    from app.models.shipment import Shipment, ShipmentLog
    from app.models.shop import Shop

    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    # Chỉ shop chủ đơn hoặc admin mới được xác nhận đóng gói
    roles = [r.role_name for r in (current_user.roles or [])]
    is_admin = "admin" in roles or "superadmin" in roles
    if not is_admin:
        shop = db.query(Shop).filter(Shop.shop_id == order.shop_id, Shop.owner_id == current_user.user_id).first()
        if not shop:
            raise HTTPException(status_code=403, detail="Không có quyền xác nhận đơn này")

    if order.order_status not in ("confirmed", "pending", "paid"):
        raise HTTPException(status_code=400, detail=f"Đơn đang ở trạng thái '{order.order_status}', không thể xác nhận đóng gói")

    # Kiểm tra / lấy shipment
    shipment = db.query(Shipment).filter(Shipment.order_id == order_id).first()
    if shipment and shipment.delivery_code:
        # Đã sinh mã rồi — trả lại mã cũ
        return {
            "message": "Đơn đã được xác nhận đóng gói trước đó",
            "delivery_code": shipment.delivery_code,
            "order_id": order_id,
        }

    # Sinh mã SD-YYYYMMDD-xxxxxx (retry nếu trùng)
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    for _ in range(5):
        suffix = "".join(random.choices(string.digits, k=6))
        code = f"SD-{today}-{suffix}"
        exists = db.query(Shipment).filter(Shipment.delivery_code == code).first()
        if not exists:
            break
    else:
        raise HTTPException(status_code=500, detail="Không thể sinh mã đơn, thử lại")

    # Lấy địa chỉ shop
    shop_obj = db.query(Shop).filter(Shop.shop_id == order.shop_id).first()
    pickup_loc = getattr(shop_obj, "address", None) or f"Shop #{order.shop_id}"

    # ── Xếp bậc kích thước ──────────────────────────────────────────────────
    dims = data or {}
    pkg_length = float(dims.get("length") or dims.get("pkg_length_cm") or 0)
    pkg_width  = float(dims.get("width")  or dims.get("pkg_width_cm")  or 0)
    pkg_height = float(dims.get("height") or dims.get("pkg_height_cm") or 0)
    pkg_weight = float(dims.get("weight") or dims.get("pkg_weight_kg") or 0)

    assigned_tier = None
    assigned_extra_fee = 0
    if pkg_length > 0 or pkg_weight > 0:
        from app.models.admin_config import ShippingSizeTier
        tiers = db.query(ShippingSizeTier).order_by(ShippingSizeTier.tier_level).all()

        tier_l = next((t for t in tiers if pkg_length <= t.max_length_cm), None) if pkg_length > 0 else tiers[0] if tiers else None
        tier_w = next((t for t in tiers if pkg_width  <= t.max_width_cm),  None) if pkg_width  > 0 else tiers[0] if tiers else None
        tier_h = next((t for t in tiers if pkg_height <= t.max_height_cm), None) if pkg_height > 0 else tiers[0] if tiers else None
        tier_k = next((t for t in tiers if pkg_weight <= t.max_weight_kg), None) if pkg_weight > 0 else tiers[0] if tiers else None

        candidates = [t for t in [tier_l, tier_w, tier_h, tier_k] if t is not None]
        if candidates:
            best = max(candidates, key=lambda t: t.tier_level)
            assigned_tier = best.tier_level
            assigned_extra_fee = best.extra_fee
        else:
            # Vượt bậc 5 — quá khổ
            assigned_tier = 6
            assigned_extra_fee = 200000

    if not shipment:
        shipment = Shipment(
            order_id=order_id,
            pickup_location=pickup_loc,
            delivery_location=order.shipping_address or "",
            delivery_code=code,
            status="packed",
            shipment_type="local",
            pkg_length_cm=pkg_length or None,
            pkg_width_cm=pkg_width or None,
            pkg_height_cm=pkg_height or None,
            pkg_weight_kg=pkg_weight or None,
            size_tier=assigned_tier,
            extra_fee=assigned_extra_fee,
        )
        db.add(shipment)
    else:
        shipment.delivery_code = code
        shipment.status = "packed"
        shipment.pickup_location = pickup_loc
        shipment.delivery_location = order.shipping_address or ""
        if pkg_length or pkg_weight:
            shipment.pkg_length_cm = pkg_length or None
            shipment.pkg_width_cm  = pkg_width or None
            shipment.pkg_height_cm = pkg_height or None
            shipment.pkg_weight_kg = pkg_weight or None
            shipment.size_tier     = assigned_tier
            shipment.extra_fee     = assigned_extra_fee

    # Cập nhật trạng thái đơn hàng
    order.order_status = "ready_to_ship"
    order.prepared_by = current_user.user_id
    order.prepared_at = datetime.now(timezone.utc)

    db.flush()

    # Ghi log
    log = ShipmentLog(
        shipment_id=shipment.shipment_id,
        status="packed",
        note=f"Shop xác nhận đóng gói. Mã đơn: {code}",
        created_by=current_user.user_id,
    )
    db.add(log)
    db.commit()

    # Notify khách hàng
    try:
        create_notification(
            db, order.user_id,
            title="📦 Đơn hàng đang được đóng gói",
            message=f"Shop đã xác nhận đóng gói đơn {order.order_number or f'#{order_id}'}. Mã vận đơn: {code}",
            notif_type="order",
            related_entity_type="order",
            related_entity_id=order_id,
            action_url=f"/orders/{order_id}",
        )
    except Exception:
        pass

    return {
        "message": "Xác nhận đóng gói thành công",
        "delivery_code": code,
        "order_id": order_id,
        "size_tier": assigned_tier,
        "extra_fee": assigned_extra_fee,
        "order_status": order.order_status,
    }


@router.get("/{order_id}/delivery-slip")
def get_delivery_slip(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Trả dữ liệu phiếu giao hàng.
    - Admin / kho: SĐT đầy đủ
    - Shipper: SĐT che 7 số đầu (***xxx4 số cuối)
    - Shop chủ đơn / khách hàng: SĐT đầy đủ
    """
    from fastapi import HTTPException
    from app.models.order import Order, OrderItem
    from app.models.shipment import Shipment
    from app.models.shop import Shop

    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    roles = [r.role_name for r in (current_user.roles or [])]
    is_admin    = "admin" in roles or "superadmin" in roles
    is_warehouse = any(r in roles for r in [
        "warehouse_manager", "warehouse_hub_manager",
        "warehouse_district_manager", "warehouse_ward_manager",
    ])
    is_shipper  = "shipper" in roles
    is_customer = current_user.user_id == order.user_id

    # Kiểm tra quyền truy cập phiếu
    shop = db.query(Shop).filter(Shop.shop_id == order.shop_id).first()
    is_shop_owner = shop and shop.owner_id == current_user.user_id
    if not (is_admin or is_warehouse or is_shipper or is_customer or is_shop_owner):
        raise HTTPException(status_code=403, detail="Không có quyền xem phiếu này")

    # Che SĐT nếu là shipper
    phone = order.recipient_phone or ""
    if is_shipper and not is_admin:
        if len(phone) > 4:
            phone = "*" * (len(phone) - 4) + phone[-4:]

    shipment = db.query(Shipment).filter(Shipment.order_id == order_id).first()

    # Danh sách hàng hóa
    items = [
        {"name": i.product_name or f"SP#{i.product_id}", "quantity": i.quantity}
        for i in (order.items or [])
    ]

    # COD
    is_cod = order.payment_method == "cod" and order.payment_status != "paid"
    cod_amount = float(order.final_price) if is_cod else 0

    return {
        "delivery_code":   shipment.delivery_code if shipment else None,
        "order_id":        order.order_id,
        "order_number":    order.order_number,
        "shop_name":       shop.shop_name if shop else f"Shop #{order.shop_id}",
        "pickup_address":  shop.address if shop else "",
        "recipient_name":  order.recipient_name,
        "recipient_phone": phone,
        "delivery_address": order.shipping_address,
        "items":           items,
        "is_cod":          is_cod,
        "cod_amount":      cod_amount,
        "payment_method":  order.payment_method,
        "payment_status":  order.payment_status,
        "shipment_status": shipment.status if shipment else None,
        "current_warehouse": (
            shipment.current_warehouse.name if shipment and shipment.current_warehouse else None
        ),
        "created_at": str(order.created_at),
    }


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
