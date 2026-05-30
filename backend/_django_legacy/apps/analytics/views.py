from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Sum, Count, Avg, F
from django.utils import timezone
from datetime import timedelta

from core.permissions import IsSeller, IsAdmin
from apps.orders.models import Order, OrderItem
from apps.products.models import Product


@api_view(["GET"])
@permission_classes([IsSeller])
def seller_dashboard(request):
    """Dashboard tổng quan cho seller"""
    shop = request.user.shop
    now = timezone.now()
    today = now.date()
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0)
    last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)

    orders_qs = Order.objects.filter(shop=shop)
    delivered_orders = orders_qs.filter(status=Order.Status.DELIVERED)

    # Revenue
    this_month_revenue = delivered_orders.filter(
        delivered_at__gte=this_month_start
    ).aggregate(total=Sum("total"))["total"] or 0

    last_month_revenue = delivered_orders.filter(
        delivered_at__gte=last_month_start,
        delivered_at__lt=this_month_start,
    ).aggregate(total=Sum("total"))["total"] or 0

    revenue_growth = 0
    if last_month_revenue > 0:
        revenue_growth = round((this_month_revenue - last_month_revenue) / last_month_revenue * 100, 1)

    # Orders stats
    pending_orders = orders_qs.filter(status=Order.Status.PENDING).count()
    today_orders = orders_qs.filter(created_at__date=today).count()

    # Top products (sold)
    top_products = (
        OrderItem.objects.filter(order__shop=shop, order__status=Order.Status.DELIVERED)
        .values("product_id", "product_name")
        .annotate(total_sold=Sum("quantity"), revenue=Sum("total_price"))
        .order_by("-total_sold")[:5]
    )

    # Products with high views but low conversion
    low_conversion = Product.objects.filter(
        shop=shop, status=Product.Status.APPROVED, view_count__gt=50
    ).annotate(
        conversion=F("total_sold") * 100.0 / F("view_count")
    ).filter(conversion__lt=2).order_by("conversion")[:5]

    return Response({
        "revenue": {
            "this_month": float(this_month_revenue),
            "last_month": float(last_month_revenue),
            "growth_percent": revenue_growth,
        },
        "orders": {
            "pending": pending_orders,
            "today": today_orders,
            "total": orders_qs.count(),
        },
        "products": {
            "total": Product.objects.filter(shop=shop).count(),
            "approved": Product.objects.filter(shop=shop, status=Product.Status.APPROVED).count(),
            "pending": Product.objects.filter(shop=shop, status=Product.Status.PENDING).count(),
        },
        "top_products": list(top_products),
        "low_conversion_products": [
            {"id": p.id, "name": p.name, "view_count": p.view_count, "total_sold": p.total_sold}
            for p in low_conversion
        ],
        "shop_rating": float(shop.rating),
    })


@api_view(["GET"])
@permission_classes([IsSeller])
def revenue_chart(request):
    """Dữ liệu biểu đồ doanh thu 30 ngày"""
    shop = request.user.shop
    days = int(request.query_params.get("days", 30))
    start = timezone.now() - timedelta(days=days)

    data = (
        Order.objects.filter(shop=shop, status=Order.Status.DELIVERED, delivered_at__gte=start)
        .extra(select={"day": "DATE(delivered_at)"})
        .values("day")
        .annotate(revenue=Sum("total"), orders=Count("id"))
        .order_by("day")
    )

    return Response(list(data))


@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_overview(request):
    """Tổng quan toàn hệ thống cho admin"""
    from apps.users.models import User
    from apps.shops.models import Shop

    return Response({
        "users": {
            "total": User.objects.count(),
            "buyers": User.objects.filter(role="buyer").count(),
            "sellers": User.objects.filter(role="seller").count(),
            "shippers": User.objects.filter(role="shipper").count(),
        },
        "shops": {
            "total": Shop.objects.count(),
            "pending": Shop.objects.filter(status="pending").count(),
            "active": Shop.objects.filter(status="active").count(),
        },
        "products": {
            "total": Product.objects.count(),
            "pending_review": Product.objects.filter(status="pending").count(),
            "flagged": Product.objects.filter(status="flagged").count(),
        },
        "orders": {
            "total": Order.objects.count(),
            "today": Order.objects.filter(created_at__date=timezone.now().date()).count(),
        },
        "revenue": Order.objects.filter(status=Order.Status.DELIVERED).aggregate(
            total=Sum("total")
        )["total"] or 0,
    })
