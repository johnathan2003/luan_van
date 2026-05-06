from celery import shared_task
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


NOTIFICATION_TEMPLATES = {
    "new_order": {
        "title": "Đơn hàng mới!",
        "message": "Bạn có đơn hàng #{order_number} mới cần xác nhận.",
        "recipient": "seller",
    },
    "order_confirmed": {
        "title": "Đơn hàng được xác nhận",
        "message": "Đơn hàng #{order_number} đã được xác nhận. Đang chuẩn bị hàng.",
        "recipient": "buyer",
    },
    "order_cancelled": {
        "title": "Đơn hàng bị huỷ",
        "message": "Đơn hàng #{order_number} đã bị huỷ.",
        "recipient": "both",
    },
    "order_delivered": {
        "title": "Giao hàng thành công",
        "message": "Đơn hàng #{order_number} đã được giao. Hãy đánh giá sản phẩm nhé!",
        "recipient": "buyer",
    },
    "low_stock": {
        "title": "Cảnh báo tồn kho thấp",
        "message": "Sản phẩm '{product_name}' chỉ còn {quantity} sản phẩm.",
        "recipient": "seller",
    },
    "shipper_assigned": {
        "title": "Shipper đang đến",
        "message": "Shipper {shipper_name} đã nhận đơn #{order_number} của bạn.",
        "recipient": "buyer",
    },
}


@shared_task(bind=True, max_retries=3)
def send_order_notification(self, order_id, notification_type):
    """Gửi notification khi có sự kiện đơn hàng"""
    try:
        from apps.orders.models import Order
        from .models import Notification

        order = Order.objects.select_related("buyer", "shop__owner").get(id=order_id)
        template = NOTIFICATION_TEMPLATES.get(notification_type)
        if not template:
            return

        message = template["message"].format(
            order_number=order.order_number,
            shipper_name=order.shipper.full_name if order.shipper else "",
        )

        recipients = []
        if template["recipient"] in ["buyer", "both"]:
            recipients.append(order.buyer)
        if template["recipient"] in ["seller", "both"]:
            recipients.append(order.shop.owner)

        channel_layer = get_channel_layer()

        for user in recipients:
            # Lưu DB
            notif = Notification.objects.create(
                user=user,
                type=Notification.Type.ORDER,
                title=template["title"],
                message=message,
                data={"order_id": str(order_id), "order_number": order.order_number},
            )

            # Push realtime qua WebSocket
            async_to_sync(channel_layer.group_send)(
                f"user_{user.id}",
                {
                    "type": "send_notification",
                    "title": template["title"],
                    "message": message,
                    "data": {"order_id": str(order_id)},
                }
            )

    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


@shared_task
def send_low_stock_alert(product_id, quantity):
    from apps.products.models import Product
    from apps.notifications.models import Notification
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    product = Product.objects.select_related("shop__owner").get(id=product_id)
    seller = product.shop.owner
    message = f"Sản phẩm '{product.name}' chỉ còn {quantity} sản phẩm."

    Notification.objects.create(
        user=seller,
        type=Notification.Type.INVENTORY,
        title="Cảnh báo tồn kho thấp",
        message=message,
        data={"product_id": str(product_id)},
    )
