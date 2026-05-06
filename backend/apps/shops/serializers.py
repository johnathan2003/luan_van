from rest_framework import serializers
from .models import Shop, ShopReview
from apps.users.serializers import UserSerializer


class ShopSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source="owner.full_name", read_only=True)

    class Meta:
        model = Shop
        fields = [
            "id", "name", "slug", "description", "logo", "banner",
            "status", "province", "district", "address",
            "lat", "lng", "rating", "total_reviews", "total_sales",
            "owner_name", "created_at",
        ]
        read_only_fields = ["id", "slug", "status", "rating", "total_reviews", "total_sales", "created_at"]


class ShopCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shop
        fields = ["name", "description", "logo", "banner", "province", "district", "address", "lat", "lng"]

    def create(self, validated_data):
        from django.utils.text import slugify
        import uuid
        name = validated_data["name"]
        slug = slugify(name)
        # Đảm bảo slug unique
        if Shop.objects.filter(slug=slug).exists():
            slug = f"{slug}-{str(uuid.uuid4())[:8]}"
        return Shop.objects.create(slug=slug, **validated_data)


class ShopReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    user_avatar = serializers.ImageField(source="user.avatar", read_only=True)

    class Meta:
        model = ShopReview
        fields = ["id", "user_name", "user_avatar", "rating", "comment", "created_at"]
        read_only_fields = ["id", "user_name", "user_avatar", "created_at"]

    def validate_rating(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Rating phải từ 1 đến 5")
        return value