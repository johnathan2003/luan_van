import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser


class TrackingConsumer(AsyncWebsocketConsumer):
    """
    WebSocket cho realtime GPS tracking.
    
    Buyer/Shop connect vào room "tracking_{order_id}" để theo dõi.
    Shipper gửi GPS lên cùng room đó.
    """

    async def connect(self):
        self.order_id = self.scope["url_route"]["kwargs"]["order_id"]
        self.room_name = f"tracking_{self.order_id}"
        user = self.scope.get("user")

        if not user or isinstance(user, AnonymousUser):
            await self.close()
            return

        # Kiểm tra quyền xem tracking này
        has_access = await self.check_access(user, self.order_id)
        if not has_access:
            await self.close()
            return

        await self.channel_layer.group_add(self.room_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_name, self.channel_name)

    async def receive(self, text_data):
        """Shipper gửi GPS location"""
        try:
            data = json.loads(text_data)
            lat = data.get("lat")
            lng = data.get("lng")
            speed = data.get("speed")

            user = self.scope["user"]
            if not user.is_shipper:
                return

            # Lưu vào DB
            await self.save_location(lat, lng, speed)

            # Broadcast cho buyer và shop
            await self.channel_layer.group_send(
                self.room_name,
                {
                    "type": "location_update",
                    "lat": lat,
                    "lng": lng,
                    "speed": speed,
                    "shipper_id": str(user.id),
                    "shipper_name": user.full_name,
                }
            )
        except (json.JSONDecodeError, KeyError):
            pass

    async def location_update(self, event):
        """Gửi update đến client"""
        await self.send(text_data=json.dumps({
            "type": "location_update",
            "lat": event["lat"],
            "lng": event["lng"],
            "speed": event.get("speed"),
            "shipper_id": event["shipper_id"],
            "shipper_name": event["shipper_name"],
        }))

    @database_sync_to_async
    def check_access(self, user, order_id):
        from apps.orders.models import Order
        try:
            order = Order.objects.get(id=order_id)
            return (
                str(order.buyer_id) == str(user.id) or
                str(order.shop.owner_id) == str(user.id) or
                (order.shipper_id and str(order.shipper_id) == str(user.id)) or
                user.role == "admin"
            )
        except Order.DoesNotExist:
            return False

    @database_sync_to_async
    def save_location(self, lat, lng, speed):
        from apps.delivery.models import Delivery, LocationTracking
        try:
            delivery = Delivery.objects.get(order_id=self.order_id)
            LocationTracking.objects.create(delivery=delivery, lat=lat, lng=lng, speed=speed)
            # Update shipper current location
            delivery.shipper.shipper_profile.current_lat = lat
            delivery.shipper.shipper_profile.current_lng = lng
            delivery.shipper.shipper_profile.save(update_fields=["current_lat", "current_lng"])
        except Delivery.DoesNotExist:
            pass


class NotificationConsumer(AsyncWebsocketConsumer):
    """WebSocket cho notification realtime"""

    async def connect(self):
        user = self.scope.get("user")
        if not user or isinstance(user, AnonymousUser):
            await self.close()
            return

        self.room_name = f"user_{user.id}"
        await self.channel_layer.group_add(self.room_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_name, self.channel_name)

    async def receive(self, text_data):
        pass

    async def send_notification(self, event):
        await self.send(text_data=json.dumps({
            "type": "notification",
            "title": event["title"],
            "message": event["message"],
            "data": event.get("data", {}),
        }))
