from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Q

from .models import ShipperProfile, Delivery, LocationTracking
from .serializers import ShipperProfileSerializer, DeliverySerializer
from core.permissions import IsShipper, IsAdmin
from apps.orders.models import Order
from apps.notifications.tasks import send_order_notification


class ShipperProfileViewSet(viewsets.ModelViewSet):
    serializer_class = ShipperProfileSerializer

    def get_queryset(self):
        return ShipperProfile.objects.filter(user=self.request.user)

    def get_permissions(self):
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=["post"])
    def go_online(self, request):
        profile = request.user.shipper_profile
        profile.status = ShipperProfile.Status.ONLINE
        profile.save(update_fields=["status"])
        return Response({"status": "online"})

    @action(detail=False, methods=["post"])
    def go_offline(self, request):
        profile = request.user.shipper_profile
        profile.status = ShipperProfile.Status.OFFLINE
        profile.save(update_fields=["status"])
        return Response({"status": "offline"})


class DeliveryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DeliverySerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == "shipper":
            return Delivery.objects.filter(shipper=user).select_related(
                "order__shop", "order__buyer"
            )
        if user.role == "admin":
            return Delivery.objects.all()
        return Delivery.objects.none()

    @action(detail=False, methods=["get"], permission_classes=[IsShipper])
    def available(self, request):
        """Đơn hàng đang chờ shipper — lọc theo khu vực"""
        shipper_profile = request.user.shipper_profile
        orders = Order.objects.filter(
            status=Order.Status.READY_FOR_PICKUP
        ).exclude(
            delivery__isnull=False
        ).select_related("shop")

        # Có thể lọc theo tỉnh/thành phố của shipper
        # orders = orders.filter(shop__province=shipper_profile.province)

        data = []
        for order in orders[:20]:
            data.append({
                "order_id": str(order.id),
                "order_number": order.order_number,
                "shop_name": order.shop.name,
                "shop_address": order.shop.address,
                "shop_lat": float(order.shop.lat) if order.shop.lat else None,
                "shop_lng": float(order.shop.lng) if order.shop.lng else None,
                "shipping_address": order.shipping_address,
                "shipping_fee": float(order.shipping_fee),
                "shipper_earn": float(order.shipping_fee) * 0.8,  # Shipper được 80%
            })
        return Response(data)

    @action(detail=True, methods=["post"], permission_classes=[IsShipper])
    def accept(self, request, pk=None):
        """Shipper nhận đơn"""
        delivery = self.get_object()
        if delivery.status != Delivery.Status.ASSIGNED:
            return Response({"error": "Đơn này không thể nhận"}, status=400)

        delivery.status = Delivery.Status.PICKING_UP
        delivery.save(update_fields=["status"])

        delivery.order.status = Order.Status.PICKED_UP
        delivery.order.shipper = request.user
        delivery.order.save(update_fields=["status", "shipper"])

        send_order_notification.delay(str(delivery.order_id), "shipper_assigned")
        return Response(DeliverySerializer(delivery).data)

    @action(detail=True, methods=["post"], permission_classes=[IsShipper])
    def update_status(self, request, pk=None):
        """Shipper cập nhật trạng thái giao hàng"""
        delivery = self.get_object()
        new_status = request.data.get("status")

        STATUS_FLOW = {
            Delivery.Status.PICKING_UP: Delivery.Status.PICKED_UP,
            Delivery.Status.PICKED_UP: Delivery.Status.IN_TRANSIT,
            Delivery.Status.IN_TRANSIT: Delivery.Status.DELIVERED,
        }
        expected_next = STATUS_FLOW.get(delivery.status)

        if new_status != expected_next:
            return Response({"error": f"Trạng thái không hợp lệ. Tiếp theo phải là: {expected_next}"}, status=400)

        delivery.status = new_status
        if new_status == Delivery.Status.PICKED_UP:
            delivery.picked_up_at = timezone.now()
            delivery.order.status = Order.Status.IN_TRANSIT
        elif new_status == Delivery.Status.DELIVERED:
            delivery.delivered_at = timezone.now()
            from apps.orders.services import OrderService
            OrderService.mark_delivered(delivery.order, request.user)
            # Cộng thu nhập shipper
            profile = request.user.shipper_profile
            profile.total_deliveries += 1
            profile.total_earned += delivery.shipper_earn
            profile.status = ShipperProfile.Status.ONLINE
            profile.save(update_fields=["total_deliveries", "total_earned", "status"])

        delivery.save()
        delivery.order.save(update_fields=["status"])
        return Response(DeliverySerializer(delivery).data)

    @action(detail=False, methods=["get"], permission_classes=[IsShipper])
    def earnings(self, request):
        """Lịch sử thu nhập của shipper"""
        deliveries = Delivery.objects.filter(
            shipper=request.user,
            status=Delivery.Status.DELIVERED
        ).select_related("order").order_by("-delivered_at")

        total_earned = sum(d.shipper_earn for d in deliveries)
        return Response({
            "total_earned": float(total_earned),
            "total_deliveries": deliveries.count(),
            "history": DeliverySerializer(deliveries[:20], many=True).data
        })


@api_view(["POST"])
@permission_classes([IsAdmin])
def assign_shipper(request, order_id):
    """Admin hoặc hệ thống tự động phân công shipper"""
    shipper_id = request.data.get("shipper_id")
    try:
        order = Order.objects.get(id=order_id)
        shipper_user = order.__class__._default_manager.model._default_manager.model
        from apps.users.models import User
        shipper = User.objects.get(id=shipper_id, role="shipper")
    except Exception as e:
        return Response({"error": str(e)}, status=400)

    delivery = Delivery.objects.create(
        order=order,
        shipper=shipper,
        fee=order.shipping_fee,
        shipper_earn=order.shipping_fee * 0.8,
    )
    order.status = Order.Status.READY_FOR_PICKUP
    order.shipper = shipper
    order.save(update_fields=["status", "shipper"])

    return Response(DeliverySerializer(delivery).data, status=201)
