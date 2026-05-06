from .models import Order, OrderItem
from apps.payments.models import Payment
from apps.inventory.models import Inventory

class OrderService:
    @staticmethod
    def create_order(user, shop, items, shipping_address):
        """Create new order from cart items"""
        total_amount = sum(item['price'] * item['quantity'] for item in items)
        order = Order.objects.create(
            user=user,
            shop=shop,
            total_amount=total_amount,
            shipping_address=shipping_address
        )
        
        for item in items:
            OrderItem.objects.create(
                order=order,
                product_id=item['product_id'],
                quantity=item['quantity'],
                price=item['price']
            )
        
        OrderService.update_inventory(order)
        return order

    @staticmethod
    def update_inventory(order):
        """Update product stock after order creation"""
        for item in order.items.all():
            Inventory.objects.decrease_stock(item.product, item.quantity)

    @staticmethod
    def confirm_payment(order_id, payment):
        """Confirm payment and update order status"""
        order = Order.objects.get(id=order_id)
        order.status = 'confirmed'
        order.save()
        payment.status = 'completed'
        payment.save()

