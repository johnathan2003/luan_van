from django.db import models
from django.core.validators import MinValueValidator


class Inventory(models.Model):
    product = models.OneToOneField("products.Product", on_delete=models.CASCADE, related_name="inventory")
    variant = models.OneToOneField("products.ProductVariant", null=True, blank=True, on_delete=models.CASCADE, related_name="inventory")

    quantity = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    reserved_quantity = models.IntegerField(default=0, validators=[MinValueValidator(0)])  # Đang giữ cho đơn hàng
    low_stock_threshold = models.IntegerField(default=10)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inventory"
        verbose_name_plural = "inventories"

    @property
    def available_quantity(self):
        """Số lượng thực sự có thể bán"""
        return self.quantity - self.reserved_quantity

    @property
    def is_low_stock(self):
        return self.available_quantity <= self.low_stock_threshold

    @property
    def is_out_of_stock(self):
        return self.available_quantity <= 0

    def __str__(self):
        return f"{self.product.name} - Còn: {self.available_quantity}"


class InventoryLog(models.Model):
    class Action(models.TextChoices):
        IMPORT = "import", "Nhập hàng"
        EXPORT = "export", "Xuất hàng"
        ADJUST = "adjust", "Điều chỉnh"
        RESERVE = "reserve", "Giữ hàng"
        RELEASE = "release", "Giải phóng"
        RETURN = "return", "Hoàn hàng"

    inventory = models.ForeignKey(Inventory, on_delete=models.CASCADE, related_name="logs")
    action = models.CharField(max_length=10, choices=Action.choices)
    quantity_change = models.IntegerField()
    quantity_before = models.IntegerField()
    quantity_after = models.IntegerField()
    note = models.TextField(blank=True)
    order = models.ForeignKey("orders.Order", null=True, blank=True, on_delete=models.SET_NULL)
    created_by = models.ForeignKey("users.User", null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inventory_logs"
        ordering = ["-created_at"]
