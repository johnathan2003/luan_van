from django.db import models
import uuid


class ShipperProfile(models.Model):
    class Status(models.TextChoices):
        OFFLINE = "offline", "Offline"
        ONLINE = "online", "Online - Sẵn sàng"
        BUSY = "busy", "Đang giao hàng"

    user = models.OneToOneField("users.User", on_delete=models.CASCADE, related_name="shipper_profile")
    vehicle_type = models.CharField(max_length=50)  # xe máy, ô tô...
    license_plate = models.CharField(max_length=20)
    id_card = models.CharField(max_length=20)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OFFLINE)
    current_lat = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    current_lng = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    total_deliveries = models.IntegerField(default=0)
    total_earned = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        db_table = "shipper_profiles"


class Delivery(models.Model):
    class Status(models.TextChoices):
        ASSIGNED = "assigned", "Đã phân công"
        PICKING_UP = "picking_up", "Đang lấy hàng"
        PICKED_UP = "picked_up", "Đã lấy hàng"
        IN_TRANSIT = "in_transit", "Đang giao"
        DELIVERED = "delivered", "Đã giao"
        FAILED = "failed", "Giao thất bại"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.OneToOneField("orders.Order", on_delete=models.CASCADE, related_name="delivery")
    shipper = models.ForeignKey("users.User", on_delete=models.PROTECT, related_name="delivery_jobs")
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.ASSIGNED)
    fee = models.DecimalField(max_digits=10, decimal_places=2)
    shipper_earn = models.DecimalField(max_digits=10, decimal_places=2)  # Phần shipper được nhận
    note = models.TextField(blank=True)
    proof_image = models.ImageField(upload_to="delivery/proofs/", null=True, blank=True)
    assigned_at = models.DateTimeField(auto_now_add=True)
    picked_up_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "deliveries"


class LocationTracking(models.Model):
    """GPS tracking - ghi mỗi 5-10 giây"""
    delivery = models.ForeignKey(Delivery, on_delete=models.CASCADE, related_name="tracking_points")
    lat = models.DecimalField(max_digits=10, decimal_places=7)
    lng = models.DecimalField(max_digits=10, decimal_places=7)
    speed = models.FloatField(null=True, blank=True)  # km/h
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "location_tracking"
        ordering = ["-timestamp"]
        indexes = [models.Index(fields=["delivery", "timestamp"])]
