from django.db import models
import uuid


class Payment(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Chờ thanh toán"
        PROCESSING = "processing", "Đang xử lý"
        SUCCESS = "success", "Thành công"
        FAILED = "failed", "Thất bại"
        REFUNDED = "refunded", "Đã hoàn tiền"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.OneToOneField("orders.Order", on_delete=models.CASCADE, related_name="payment")
    method = models.CharField(max_length=20)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDING)
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    # Gateway response
    transaction_id = models.CharField(max_length=255, blank=True)
    gateway_response = models.JSONField(default=dict)

    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "payments"

    def __str__(self):
        return f"Payment {self.order.order_number} - {self.status}"


class Refund(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Chờ xử lý"
        APPROVED = "approved", "Đã duyệt"
        REJECTED = "rejected", "Từ chối"
        COMPLETED = "completed", "Hoàn thành"

    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name="refunds")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "refunds"