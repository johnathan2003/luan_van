from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class LocationUpdate(BaseModel):
    lat: float
    lng: float
    timestamp: Optional[str] = None


class ShipperStatusUpdate(BaseModel):
    status: str  # 'available' | 'on_delivery' | 'offline'


class ShipmentResponse(BaseModel):
    shipment_id: int
    order_id: int
    shipper_id: Optional[int]
    pickup_location: Optional[str]
    delivery_location: Optional[str]
    status: str
    pickup_time: Optional[datetime]
    delivery_time: Optional[datetime]
    current_location: Optional[dict]

    class Config:
        from_attributes = True


class ShipperResponse(BaseModel):
    shipper_id: int
    vehicle_type: Optional[str]
    license_plate: Optional[str]
    status: str
    rating: str
    total_deliveries: int

    class Config:
        from_attributes = True


class ShipmentRejectRequest(BaseModel):
    reason: str


class ShipmentFailureRequest(BaseModel):
    reason: str
