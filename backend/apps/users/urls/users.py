from django.urls import path
from apps.users import views

urlpatterns = [
    path("addresses/", views.AddressListCreateView.as_view()),
    path("addresses/<int:pk>/", views.AddressDetailView.as_view()),
]
