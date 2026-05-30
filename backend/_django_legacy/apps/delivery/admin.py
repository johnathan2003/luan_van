from django.contrib import admin
from .models import ShipperProfile, Delivery, LocationTracking


@admin.register(ShipperProfile)
class ShipperProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "vehicle_type", "license_plate", "status", "rating", "total_deliveries", "total_earned"]
    list_filter = ["status", "vehicle_type"]
    search_fields = ["user__email", "license_plate"]


@admin.register(Delivery)
class DeliveryAdmin(admin.ModelAdmin):
    list_display = ["order", "shipper", "status", "fee", "shipper_earn", "assigned_at", "delivered_at"]
    list_filter = ["status"]
    search_fields = ["order__order_number", "shipper__email"]
    readonly_fields = ["assigned_at"]


@admin.register(LocationTracking)
class LocationTrackingAdmin(admin.ModelAdmin):
    list_display = ["delivery", "lat", "lng", "speed", "timestamp"]
    list_filter = ["timestamp"]
    ordering = ["-timestamp"]
