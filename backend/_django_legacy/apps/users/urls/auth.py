from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from apps.users import views

urlpatterns = [
    path("register/", views.register),
    path("login/", views.login),
    path("logout/", views.logout),
    path("profile/", views.profile),
    path("token/refresh/", TokenRefreshView.as_view()),
]
