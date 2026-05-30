from django.contrib import admin
from .models import Inventory, InventoryLog


class InventoryLogInline(admin.TabularInline):
    model = InventoryLog
    extra = 0
    readonly_fields = ["action", "quantity_change", "quantity_before", "quantity_after", "note", "created_by", "created_at"]
    can_delete = False


@admin.register(Inventory)
class InventoryAdmin(admin.ModelAdmin):
    list_display = ["product", "quantity", "reserved_quantity", "available_quantity", "is_low_stock", "updated_at"]
    search_fields = ["product__name"]
    readonly_fields = ["reserved_quantity", "updated_at"]
    inlines = [InventoryLogInline]

    def available_quantity(self, obj):
        return obj.available_quantity
    available_quantity.short_description = "Có thể bán"

    def is_low_stock(self, obj):
        return obj.is_low_stock
    is_low_stock.boolean = True
    is_low_stock.short_description = "Sắp hết?"


@admin.register(InventoryLog)
class InventoryLogAdmin(admin.ModelAdmin):
    list_display = ["inventory", "action", "quantity_change", "quantity_before", "quantity_after", "created_by", "created_at"]
    list_filter = ["action"]
    readonly_fields = ["created_at"]
