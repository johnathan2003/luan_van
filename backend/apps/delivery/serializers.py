from rest_framework import serializers
from .models import ShipperProfile, Delivery, LocationTracking


class ShipperProfileSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    user_phone = serializers.CharField(source="user.phone", read_only=True)
    user_avatar = serializers.ImageField(source="user.avatar", read_only=True)

    class Meta:
        model = ShipperProfile
        fields = [
            "id", "user_name", "user_phone", "user_avatar",
            "vehicle_type", "license_plate", "status",
            "current_lat", "current_lng",
            "rating", "total_deliveries", "total_earned",
        ]
        read_only_fields = ["rating", "total_deliveries", "total_earned"]


class LocationTrackingSerializer(serializers.ModelSerializer):
    class Meta:
        model = LocationTracking
        fields = ["lat", "lng", "speed", "timestamp"]


class DeliverySerializer(serializers.ModelSerializer):
    shipper = ShipperProfileSerializer(source="shipper.shipper_profile", read_only=True)
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    buyer_name = serializers.CharField(source="order.receiver_name", read_only=True)
    buyer_phone = serializers.CharField(source="order.receiver_phone", read_only=True)
    shipping_address = serializers.CharField(source="order.shipping_address", read_only=True)
    shipping_lat = serializers.DecimalField(source="order.shipping_lat", max_digits=10, decimal_places=7, read_only=True)
    shipping_lng = serializers.DecimalField(source="order.shipping_lng", max_digits=10, decimal_places=7, read_only=True)
    shop_name = serializers.CharField(source="order.shop.name", read_only=True)
    shop_address = serializers.CharField(source="order.shop.address", read_only=True)
    shop_lat = serializers.DecimalField(source="order.shop.lat", max_digits=10, decimal_places=7, read_only=True)
    shop_lng = serializers.DecimalField(source="order.shop.lng", max_digits=10, decimal_places=7, read_only=True)
    latest_location = serializers.SerializerMethodField()

    class Meta:
        model = Delivery
        fields = [
            "id", "order_number", "status", "fee", "shipper_earn",
            "buyer_name", "buyer_phone", "shipping_address", "shipping_lat", "shipping_lng",
            "shop_name", "shop_address", "shop_lat", "shop_lng",
            "shipper", "latest_location",
            "assigned_at", "picked_up_at", "delivered_at",
        ]

    def get_latest_location(self, obj):
        point = obj.tracking_points.order_by("-timestamp").first()
        if point:
            return LocationTrackingSerializer(point).data
        return None
