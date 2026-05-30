from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Payment
from ..orders.models import Order
from ..orders.services import OrderService

class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Payment.objects.select_related('order__user', 'order__shop')
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(order__user=self.request.user)

    @action(detail=False, methods=['post'])
    def create(self, request):
        order_id = request.data.get('order_id')
        provider = request.data.get('provider', 'cod')
        
        try:
            order = Order.objects.get(id=order_id, user=request.user, status='pending')
        except Order.DoesNotExist:
            return Response({'error': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
        
        payment = Payment.objects.create(
            order=order,
            amount=order.total_amount,
            provider=provider
        )
        
        if provider == 'cod':
            OrderService.confirm_payment(order.id, payment)
            return Response({'message': 'COD order confirmed', 'payment': payment.id})
        
        return Response({'payment_id': payment.id, 'provider': provider})

