from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Address


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["email", "full_name", "role", "is_active", "is_verified", "created_at"]
    list_filter = ["role", "is_active", "is_verified"]
    search_fields = ["email", "full_name", "phone"]
    ordering = ["-created_at"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Thông tin", {"fields": ("full_name", "phone", "avatar", "role")}),
        ("Quyền", {"fields": ("is_active", "is_staff", "is_superuser", "is_verified")}),
        ("Ngày", {"fields": ("last_login", "created_at")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "full_name", "password1", "password2", "role")}),
    )
    readonly_fields = ["created_at"]


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ["user", "label", "province", "district", "is_default"]
    search_fields = ["user__email", "receiver_name"]
