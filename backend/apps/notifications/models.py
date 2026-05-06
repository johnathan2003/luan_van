from django.db import models


class Notification(models.Model):
    class Type(models.TextChoices):
        ORDER = "order", "Đơn hàng"
        DELIVERY = "delivery", "Giao hàng"
        SYSTEM = "system", "Hệ thống"
        PROMOTION = "promotion", "Khuyến mãi"
        INVENTORY = "inventory", "Tồn kho"

    user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="notifications")
    type = models.CharField(max_length=15, choices=Type.choices)
    title = models.CharField(max_length=255)
    message = models.TextField()
    data = models.JSONField(default=dict)  # Extra data (order_id, etc.)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]
