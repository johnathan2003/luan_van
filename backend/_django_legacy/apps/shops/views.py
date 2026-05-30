from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import Shop, ShopReview
from .serializers import ShopSerializer, ShopCreateSerializer, ShopReviewSerializer
from core.permissions import IsSeller, IsAdmin


class ShopViewSet(viewsets.ModelViewSet):
    queryset = Shop.objects.select_related("owner").all()
    filter_fields = ["status", "province"]

    def get_serializer_class(self):
        if self.action == "create":
            return ShopCreateSerializer
        return ShopSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]
        if self.action == "create":
            return [IsSeller()]
        if self.action in ["update", "partial_update"]:
            return [IsSeller()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = Shop.objects.select_related("owner")
        if not user.is_authenticated or user.role == "buyer":
            return qs.filter(status=Shop.Status.ACTIVE)
        if user.role == "seller":
            return qs.filter(owner=user)
        return qs  # admin thấy tất cả

    def perform_create(self, serializer):
        # Kiểm tra user chưa có shop
        if hasattr(self.request.user, "shop"):
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Bạn đã có shop rồi")
        serializer.save(owner=self.request.user)

    @action(detail=False, methods=["get"], permission_classes=[IsSeller])
    def my_shop(self, request):
        """Seller lấy thông tin shop của mình"""
        try:
            shop = request.user.shop
            return Response(ShopSerializer(shop).data)
        except Shop.DoesNotExist:
            return Response({"detail": "Bạn chưa có shop"}, status=404)

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def approve(self, request, pk=None):
        shop = self.get_object()
        shop.status = Shop.Status.ACTIVE
        shop.save(update_fields=["status"])
        # Đổi role user thành seller (nếu chưa)
        if shop.owner.role != "seller":
            shop.owner.role = "seller"
            shop.owner.save(update_fields=["role"])
        return Response(ShopSerializer(shop).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def suspend(self, request, pk=None):
        shop = self.get_object()
        reason = request.data.get("reason", "")
        shop.status = Shop.Status.SUSPENDED
        shop.save(update_fields=["status"])
        return Response({"message": f"Shop đã bị đình chỉ. Lý do: {reason}"})

    @action(detail=True, methods=["get"], permission_classes=[AllowAny])
    def reviews(self, request, pk=None):
        shop = self.get_object()
        reviews = ShopReview.objects.filter(shop=shop).select_related("user")
        page = self.paginate_queryset(reviews)
        serializer = ShopReviewSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def add_review(self, request, pk=None):
        shop = self.get_object()
        serializer = ShopReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = serializer.save(shop=shop, user=request.user)
        # Cập nhật rating trung bình
        from django.db.models import Avg
        avg = ShopReview.objects.filter(shop=shop).aggregate(avg=Avg("rating"))["avg"] or 0
        shop.rating = round(avg, 2)
        shop.total_reviews = ShopReview.objects.filter(shop=shop).count()
        shop.save(update_fields=["rating", "total_reviews"])
        return Response(ShopReviewSerializer(review).data, status=201)