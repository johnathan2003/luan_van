from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task
def check_low_stock():
    """
    Chạy mỗi 2 tiếng — kiểm tra sản phẩm sắp hết hàng
    và gửi cảnh báo cho seller.
    """
    from .models import Inventory
    from apps.notifications.tasks import send_low_stock_alert

    inventories = Inventory.objects.select_related(
        "product__shop__owner", "product"
    ).filter(
        product__status="approved"
    )

    alerted_count = 0
    for inv in inventories:
        if inv.is_low_stock and not inv.is_out_of_stock:
            send_low_stock_alert.delay(str(inv.product_id), inv.available_quantity)
            alerted_count += 1
        elif inv.is_out_of_stock:
            # Ẩn sản phẩm hết hàng
            from apps.products.models import Product
            Product.objects.filter(id=inv.product_id).update(
                status=Product.Status.HIDDEN
            )
            logger.info(f"Product {inv.product_id} hidden due to out of stock")

    logger.info(f"Low stock check done. Alerted: {alerted_count}")


@shared_task
def send_daily_seller_report():
    """
    Gửi báo cáo hàng ngày cho seller — chạy lúc 8h sáng.
    """
    from apps.shops.models import Shop
    from apps.orders.models import Order
    from django.utils import timezone
    from django.db.models import Sum, Count
    from datetime import timedelta

    yesterday = timezone.now().date() - timedelta(days=1)

    for shop in Shop.objects.filter(status="active").select_related("owner"):
        stats = Order.objects.filter(
            shop=shop,
            status=Order.Status.DELIVERED,
            delivered_at__date=yesterday,
        ).aggregate(
            total_orders=Count("id"),
            total_revenue=Sum("total"),
        )

        if stats["total_orders"]:
            from apps.notifications.models import Notification
            Notification.objects.create(
                user=shop.owner,
                type=Notification.Type.SYSTEM,
                title="Báo cáo hôm qua",
                message=(
                    f"Shop {shop.name}: {stats['total_orders']} đơn, "
                    f"doanh thu {stats['total_revenue']:,.0f}đ"
                ),
                data={"date": str(yesterday)},
            )
