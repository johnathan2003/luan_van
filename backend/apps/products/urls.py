from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProductViewSet, CategoryViewSet, ProductReviewViewSet

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="categories")
router.register("", ProductViewSet, basename="products")

urlpatterns = [
    path("", include(router.urls)),
    # Nested reviews: /products/{product_pk}/reviews/
    path("<uuid:product_pk>/reviews/", ProductReviewViewSet.as_view({"get": "list", "post": "create"})),
    path("<uuid:product_pk>/reviews/<int:pk>/", ProductReviewViewSet.as_view({"get": "retrieve", "delete": "destroy"})),
]