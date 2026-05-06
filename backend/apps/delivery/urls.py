from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DeliveryViewSet, ShipperProfileViewSet, assign_shipper

router = DefaultRouter()
router.register("profile", ShipperProfileViewSet, basename="shipper-profile")
router.register("", DeliveryViewSet, basename="delivery")

urlpatterns = [
    path("", include(router.urls)),
    path("assign/<uuid:order_id>/", assign_shipper),
]
