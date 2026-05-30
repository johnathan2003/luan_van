from app.websocket.connection_manager import sio, send_to_user, send_to_room


async def notify_order_created(user_id: int, shop_id: int, order_data: dict):
    await send_to_user(user_id, "notification", {
        "type": "order_created",
        "title": "Đơn hàng đã được đặt",
        "message": f"Đơn hàng #{order_data.get('order_id')} đã được tạo thành công",
        "data": order_data,
    })
    await send_to_user(shop_id, "notification", {
        "type": "new_order",
        "title": "Đơn hàng mới",
        "message": f"Bạn có đơn hàng mới #{order_data.get('order_id')}",
        "data": order_data,
    })


async def notify_order_confirmed(user_id: int, order_id: int):
    await send_to_user(user_id, "notification", {
        "type": "order_confirmed",
        "title": "Đơn hàng được xác nhận",
        "message": f"Đơn hàng #{order_id} đã được shop xác nhận",
        "data": {"order_id": order_id},
    })


async def notify_order_shipping(user_id: int, shipper_id: int, order_id: int):
    await send_to_user(user_id, "notification", {
        "type": "order_shipping",
        "title": "Đơn hàng đang giao",
        "message": f"Đơn hàng #{order_id} đang được vận chuyển",
        "data": {"order_id": order_id},
    })


async def notify_location_update(order_id: int, location: dict):
    await send_to_room(f"tracking_{order_id}", "location_update", {
        "order_id": order_id,
        "location": location,
    })


async def notify_payment_success(user_id: int, order_id: int, amount: str):
    await send_to_user(user_id, "notification", {
        "type": "payment_success",
        "title": "Thanh toán thành công",
        "message": f"Thanh toán {amount} cho đơn hàng #{order_id} thành công",
        "data": {"order_id": order_id, "amount": amount},
    })


async def notify_shop_approved(user_id: int, shop_name: str):
    await send_to_user(user_id, "notification", {
        "type": "shop_approved",
        "title": "Shop được duyệt",
        "message": f"Shop '{shop_name}' của bạn đã được phê duyệt!",
        "data": {"shop_name": shop_name},
    })


async def notify_product_approved(shop_id: int, product_name: str, product_id: int):
    await send_to_user(shop_id, "notification", {
        "type": "product_approved",
        "title": "Sản phẩm được duyệt",
        "message": f"Sản phẩm '{product_name}' đã được phê duyệt và đang bán",
        "data": {"product_id": product_id},
    })
