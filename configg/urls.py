from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerUIView

API_V1 = "api/v1/"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerUIView.as_view(url_name="schema"), name="swagger-ui"),

    path(API_V1 + "auth/", include("apps.users.urls.auth")),
    path(API_V1 + "users/", include("apps.users.urls.users")),
    path(API_V1 + "shops/", include("apps.shops.urls")),
    path(API_V1 + "products/", include("apps.products.urls")),
    path(API_V1 + "orders/", include("apps.orders.urls")),
    path(API_V1 + "payments/", include("apps.payments.urls")),
    path(API_V1 + "delivery/", include("apps.delivery.urls")),
    path(API_V1 + "inventory/", include("apps.inventory.urls")),
    path(API_V1 + "notifications/", include("apps.notifications.urls")),
    path(API_V1 + "analytics/", include("apps.analytics.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)