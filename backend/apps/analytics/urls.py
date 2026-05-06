from django.urls import path
from . import views

urlpatterns = [
    path("seller/dashboard/", views.seller_dashboard),
    path("seller/revenue/", views.revenue_chart),
    path("admin/overview/", views.admin_overview),
]
