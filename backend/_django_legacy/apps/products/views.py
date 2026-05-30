from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Product, ProductVariant
from .serializers import ProductSerializer, ProductVariantSerializer
from core.utils.pagination import CustomPagination
from django_filters.rest_framework import DjangoFilterBackend

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.filter(is_active=True).select_related('shop', 'category')
    serializer_class = ProductSerializer
    pagination_class = CustomPagination
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['shop', 'category', 'price__gte', 'price__lte']

    @action(detail=False, methods=['get'])
    def featured(self, request):
        products = self.queryset.filter(is_active=True)[:10]
        serializer = self.get_serializer(products, many=True)
        return Response(serializer.data)

class ProductVariantViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ProductVariant.objects.all()
    serializer_class = ProductVariantSerializer

