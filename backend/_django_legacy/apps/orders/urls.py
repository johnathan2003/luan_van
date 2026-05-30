from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OrderViewSet, CartViewSet

router = DefaultRouter()
router.register("cart", CartViewSet, basename="cart")
router.register("", OrderViewSet, basename="orders")

urlpatterns = [
    path("", include(router.urls)),
]