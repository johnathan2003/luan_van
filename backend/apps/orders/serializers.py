from rest_framework import serializers
from .models import Order, OrderItem, OrderStatusHistory, Cart, CartItem
from apps.products.serializers import ProductSerializer


class CartItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_thumbnail = serializers.ImageField(source="product.thumbnail", read_only=True)
    product_price = serializers.DecimalField(source="product.price", max_digits=12, decimal_places=2, read_only=True)
    variant_name = serializers.CharField(source="variant.name", read_only=True)
    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = [
            "id", "product", "product_name", "product_thumbnail",
            "product_price", "variant", "variant_name", "quantity", "subtotal",
        ]

    def get_subtotal(self, obj):
        price = obj.variant.price if obj.variant else obj.product.price
        return float(price) * obj.quantity


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_items = serializers.SerializerMethodField()
    total_price = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ["id", "items", "total_items", "total_price"]

    def get_total_items(self, obj):
        return sum(item.quantity for item in obj.items.all())

    def get_total_price(self, obj):
        total = 0
        for item in obj.items.all():
            price = item.variant.price if item.variant else item.product.price
            total += float(price) * item.quantity
        return total


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = [
            "id", "product", "variant", "product_name", "product_image",
            "variant_name", "quantity", "unit_price", "total_price",
        ]


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source="changed_by.full_name", read_only=True)

    class Meta:
        model = OrderStatusHistory
        fields = ["status", "note", "changed_by_name", "created_at"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)
    buyer_name = serializers.CharField(source="buyer.full_name", read_only=True)
    shop_name = serializers.CharField(source="shop.name", read_only=True)
    shipper_name = serializers.SerializerMethodField()
    shipper_phone = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id", "order_number", "status", "payment_method", "payment_status",
            "buyer_name", "shop_name", "shipper_name", "shipper_phone",
            "receiver_name", "receiver_phone", "shipping_address",
            "subtotal", "shipping_fee", "discount", "total",
            "note", "cancel_reason",
            "items", "status_history",
            "created_at", "confirmed_at", "delivered_at",
        ]
        read_only_fields = ["id", "order_number", "status", "payment_status", "created_at"]

    def get_shipper_name(self, obj):
        return obj.shipper.full_name if obj.shipper else None

    def get_shipper_phone(self, obj):
        return obj.shipper.phone if obj.shipper else None


class OrderListSerializer(serializers.ModelSerializer):
    """Dùng cho list — ít field hơn để load nhanh"""
    shop_name = serializers.CharField(source="shop.name", read_only=True)
    shop_logo = serializers.ImageField(source="shop.logo", read_only=True)
    item_count = serializers.SerializerMethodField()
    first_item = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id", "order_number", "status", "payment_method",
            "shop_name", "shop_logo", "total", "item_count",
            "first_item", "created_at",
        ]

    def get_item_count(self, obj):
        return obj.items.count()

    def get_first_item(self, obj):
        item = obj.items.first()
        if item:
            return {"name": item.product_name, "image": item.product_image, "quantity": item.quantity}
        return None