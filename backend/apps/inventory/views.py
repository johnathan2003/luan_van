from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import serializers as drf_serializers

from .models import Inventory, InventoryLog
from core.permissions import IsSeller, IsAdmin


class InventorySerializer(drf_serializers.ModelSerializer):
    product_name = drf_serializers.CharField(source="product.name", read_only=True)
    product_thumbnail = drf_serializers.ImageField(source="product.thumbnail", read_only=True)
    available_quantity = drf_serializers.IntegerField(read_only=True)
    is_low_stock = drf_serializers.BooleanField(read_only=True)
    is_out_of_stock = drf_serializers.BooleanField(read_only=True)

    class Meta:
        model = Inventory
        fields = [
            "id", "product", "product_name", "product_thumbnail",
            "quantity", "reserved_quantity", "available_quantity",
            "low_stock_threshold", "is_low_stock", "is_out_of_stock",
            "updated_at",
        ]
        read_only_fields = ["reserved_quantity", "available_quantity", "updated_at"]


class InventoryLogSerializer(drf_serializers.ModelSerializer):
    class Meta:
        model = InventoryLog
        fields = ["id", "action", "quantity_change", "quantity_before", "quantity_after", "note", "created_at"]


class InventoryViewSet(viewsets.ModelViewSet):
    serializer_class = InventorySerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == "seller":
            return Inventory.objects.filter(product__shop__owner=user).select_related("product")
        if user.role == "admin":
            return Inventory.objects.all().select_related("product")
        return Inventory.objects.none()

    def get_permissions(self):
        return [IsSeller()]

    @action(detail=True, methods=["post"])
    def import_stock(self, request, pk=None):
        """Nhập thêm hàng vào kho"""
        inventory = self.get_object()
        quantity = int(request.data.get("quantity", 0))
        note = request.data.get("note", "Nhập hàng")

        if quantity <= 0:
            return Response({"error": "Số lượng phải lớn hơn 0"}, status=400)

        before = inventory.quantity
        inventory.quantity += quantity
        inventory.save(update_fields=["quantity"])

        InventoryLog.objects.create(
            inventory=inventory,
            action=InventoryLog.Action.IMPORT,
            quantity_change=quantity,
            quantity_before=before,
            quantity_after=inventory.quantity,
            note=note,
            created_by=request.user,
        )
        return Response(InventorySerializer(inventory).data)

    @action(detail=True, methods=["patch"])
    def set_threshold(self, request, pk=None):
        """Cài ngưỡng cảnh báo tồn kho thấp"""
        inventory = self.get_object()
        threshold = request.data.get("threshold")
        if threshold is None or int(threshold) < 0:
            return Response({"error": "Ngưỡng không hợp lệ"}, status=400)
        inventory.low_stock_threshold = int(threshold)
        inventory.save(update_fields=["low_stock_threshold"])
        return Response(InventorySerializer(inventory).data)

    @action(detail=True, methods=["get"])
    def logs(self, request, pk=None):
        """Lịch sử thay đổi tồn kho"""
        inventory = self.get_object()
        logs = InventoryLog.objects.filter(inventory=inventory)
        page = self.paginate_queryset(logs)
        return self.get_paginated_response(InventoryLogSerializer(page, many=True).data)

    @action(detail=False, methods=["get"])
    def low_stock(self, request):
        """Danh sách sản phẩm sắp hết hàng"""
        inventories = self.get_queryset().filter(
            quantity__lte=drf_serializers.IntegerField().run_validation
        )
        # Filter thủ công vì property không dùng được trong ORM filter
        low = [inv for inv in self.get_queryset() if inv.is_low_stock]
        return Response(InventorySerializer(low, many=True).data)
