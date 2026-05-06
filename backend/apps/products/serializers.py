from rest_framework import serializers
from .models import Product, ProductImage, ProductVariant, ProductReview, Category


class CategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "icon", "parent", "children"]

    def get_children(self, obj):
        if obj.children.exists():
            return CategorySerializer(obj.children.filter(is_active=True), many=True).data
        return []


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "image", "order"]


class ProductVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = ["id", "name", "sku", "price", "attributes", "image"]


class ProductSerializer(serializers.ModelSerializer):
    """Dùng trong list — ít field hơn để response nhanh"""
    shop_name = serializers.CharField(source="shop.name", read_only=True)
    shop_id = serializers.UUIDField(source="shop.id", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "name", "slug", "price", "original_price", "discount_percent",
            "thumbnail", "rating", "total_reviews", "total_sold", "view_count",
            "shop_id", "shop_name", "category_name", "status", "created_at",
        ]


class ProductDetailSerializer(serializers.ModelSerializer):
    """Dùng trong detail — đầy đủ hơn"""
    images = ProductImageSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    shop_name = serializers.CharField(source="shop.name", read_only=True)
    shop_id = serializers.UUIDField(source="shop.id", read_only=True)
    shop_rating = serializers.FloatField(source="shop.rating", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "name", "slug", "description", "price", "original_price",
            "discount_percent", "thumbnail", "images", "variants",
            "rating", "total_reviews", "total_sold", "view_count",
            "shop_id", "shop_name", "shop_rating", "category_name",
            "status", "tags", "weight", "created_at",
        ]


class ProductCreateSerializer(serializers.ModelSerializer):
    images = serializers.ListField(
        child=serializers.ImageField(), write_only=True, required=False
    )
    variants = ProductVariantSerializer(many=True, required=False)

    class Meta:
        model = Product
        fields = [
            "name", "description", "price", "original_price",
            "category", "thumbnail", "images", "variants",
            "tags", "weight",
        ]

    def create(self, validated_data):
        from django.utils.text import slugify
        import uuid
        images_data = validated_data.pop("images", [])
        variants_data = validated_data.pop("variants", [])

        name = validated_data["name"]
        slug = slugify(name)
        if Product.objects.filter(slug=slug).exists():
            slug = f"{slug}-{str(uuid.uuid4())[:8]}"

        product = Product.objects.create(slug=slug, **validated_data)

        for i, img in enumerate(images_data):
            ProductImage.objects.create(product=product, image=img, order=i)

        for v in variants_data:
            ProductVariant.objects.create(product=product, **v)

        # Tạo inventory
        from apps.inventory.models import Inventory
        Inventory.objects.create(product=product)

        return product


class ProductReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    user_avatar = serializers.ImageField(source="user.avatar", read_only=True)

    class Meta:
        model = ProductReview
        fields = ["id", "user_name", "user_avatar", "rating", "comment", "images", "created_at"]
        read_only_fields = ["id", "user_name", "user_avatar", "created_at"]

    def validate_rating(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Rating phải từ 1 đến 5")
        return value