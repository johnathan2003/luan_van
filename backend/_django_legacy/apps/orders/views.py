from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Order, OrderItem
from .serializers import OrderSerializer, CreateOrderSerializer
from .services import OrderService
from core.utils.pagination import CustomPagination

class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.select_related('user', 'shop').prefetch_related('items__product')
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = CustomPagination

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user).order_by('-created_at')

    @action(detail=False, methods=['post'])
    def create(self, request):
        serializer = CreateOrderSerializer(data=request.data)
        if serializer.is_valid():
            order = OrderService.create_order(
                user=request.user,
                shop_id=serializer.validated_data['shop_id'],
                items=serializer.validated_data['items'],
                shipping_address=serializer.validated_data['shipping_address']
            )
            return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status in ['delivered', 'cancelled']:
            return Response({'error': 'Cannot cancel this order'}, status=status.HTTP_400_BAD_REQUEST)
        order.status = 'cancelled'
        order.save()
        return Response({'message': 'Order cancelled'})

