# core/permissions __init__.py

from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsBuyer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "buyer"


class IsSeller(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "seller"


class IsShipper(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "shipper"


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "admin"


class IsShopOwner(BasePermission):
    """User phải là seller VÀ là chủ shop của object"""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == "seller"

    def has_object_permission(self, request, view, obj):
        # obj có thể là Product, Order, Shop...
        if hasattr(obj, "shop"):
            return obj.shop.owner == request.user
        if hasattr(obj, "owner"):
            return obj.owner == request.user
        return False


class IsOrderParticipant(BasePermission):
    """Buyer, Seller của shop, hoặc Shipper của đơn"""
    def has_object_permission(self, request, view, obj):
        user = request.user
        return (
            obj.buyer == user or
            obj.shop.owner == user or
            obj.shipper == user or
            user.role == "admin"
        )


class IsSellerOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_authenticated and request.user.role == "seller"