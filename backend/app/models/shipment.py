from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, JSON, Index, Numeric, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Warehouse(Base):
    """Kho hàng 3 cấp: tier=1 (city hub), tier=2 (quận/huyện), tier=3 (phường/xã)."""
    __tablename__ = "warehouses"

    warehouse_id         = Column(Integer, primary_key=True, autoincrement=True)
    name                 = Column(String(200), nullable=False)
    province             = Column(String(100), nullable=False)
    address              = Column(String(500))
    lat                  = Column(Numeric(10, 6))
    lng                  = Column(Numeric(10, 6))
    # Cấp kho: 1=city hub, 2=district, 3=ward
    tier                 = Column(Integer, nullable=False, server_default='3')
    # Thành phố: 'hanoi' | 'hcmc'
    city                 = Column(String(50))
    district             = Column(String(100))
    ward                 = Column(String(100))
    ward_code            = Column(String(20))
    parent_warehouse_id  = Column(Integer, ForeignKey("warehouses.warehouse_id"), nullable=True)
    # Manager mặc định gắn với kho này (1-1 cho ward level)
    manager_id           = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    is_active            = Column(Boolean, default=True)
    created_at           = Column(DateTime, server_default=func.now())

    # Relationships
    managers        = relationship("WarehouseManager", back_populates="warehouse")
    ward_shippers   = relationship("WarehouseShipper", back_populates="warehouse")
    children        = relationship("Warehouse", foreign_keys="[Warehouse.parent_warehouse_id]",
                                   backref=__import__('sqlalchemy.orm', fromlist=['backref']).backref('parent', remote_side='Warehouse.warehouse_id'))
    outgoing        = relationship("Shipment", foreign_keys="[Shipment.src_warehouse_id]", back_populates="src_warehouse")
    incoming        = relationship("Shipment", foreign_keys="[Shipment.dest_warehouse_id]", back_populates="dest_warehouse")


class WarehouseManager(Base):
    """Người quản lý kho — gắn 1 user với 1 kho."""
    __tablename__ = "warehouse_managers"

    manager_id   = Column(Integer, ForeignKey("users.user_id"), primary_key=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.warehouse_id"), nullable=True)
    created_at   = Column(DateTime, server_default=func.now())

    user      = relationship("User", foreign_keys=[manager_id])
    warehouse = relationship("Warehouse", back_populates="managers")


class WarehouseShipper(Base):
    """Liên kết shipper với kho cấp 3 (phường/xã) — mỗi kho có ít nhất 1 shipper."""
    __tablename__ = "warehouse_shippers"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.warehouse_id"), nullable=False)
    shipper_id   = Column(Integer, ForeignKey("shippers.shipper_id"), nullable=False)
    assigned_by  = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    assigned_at  = Column(DateTime, server_default=func.now())
    status       = Column(String(20), default='active')   # active | off_duty | suspended

    warehouse = relationship("Warehouse", back_populates="ward_shippers")
    shipper   = relationship("Shipper", foreign_keys=[shipper_id])


class Shipper(Base):
    __tablename__ = "shippers"

    shipper_id    = Column(Integer, ForeignKey("users.user_id"), primary_key=True)
    vehicle_type  = Column(String(50))
    license_plate = Column(String(20))
    # Loại shipper: free=tự do, zone=khu vực, inter_province=liên tỉnh (xe tải)
    shipper_type  = Column(String(50), server_default='free', nullable=True)
    # Khu vực phụ trách (cho zone shipper)
    zone_province = Column(String(100))
    # Kho gắn với (cho inter_province shipper)
    home_warehouse_id = Column(Integer, ForeignKey("warehouses.warehouse_id"), nullable=True)

    current_location = Column(JSON)
    status = Column(Enum("available", "on_delivery", "offline", native_enum=False), default="offline", index=True)
    rating = Column(String(5), default="0.00")
    total_deliveries = Column(Integer, default=0)
    verified_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user          = relationship("User", back_populates="shipper", foreign_keys=[shipper_id])
    shipments     = relationship("Shipment", back_populates="shipper")
    home_warehouse = relationship("Warehouse", foreign_keys=[home_warehouse_id])


class ShipperRegistration(Base):
    __tablename__ = "shipper_registrations"

    reg_id           = Column(Integer, primary_key=True, autoincrement=True)
    user_id          = Column(Integer, ForeignKey("users.user_id"), nullable=False, unique=True)
    vehicle_type     = Column(String(50))
    license_plate    = Column(String(20))
    shipper_type     = Column(String(50), server_default='free', nullable=True)
    zone_province    = Column(String(100))
    zone_district    = Column(String(100))
    zone_ward        = Column(String(100))
    home_warehouse_id = Column(Integer, ForeignKey("warehouses.warehouse_id"), nullable=True)

    license_url      = Column(String(500))
    registration_url = Column(String(500))
    id_card_url      = Column(String(500))
    status           = Column(Enum("pending", "approved", "rejected", native_enum=False), default="pending", index=True)

    rejection_reason = Column(String(500))
    reviewed_by      = Column(Integer, ForeignKey("users.user_id"))
    reviewed_at      = Column(DateTime)
    created_at       = Column(DateTime, server_default=func.now())

    user      = relationship("User", foreign_keys=[user_id])
    reviewer  = relationship("User", foreign_keys=[reviewed_by])
    home_warehouse = relationship("Warehouse", foreign_keys=[home_warehouse_id])


class Shipment(Base):
    __tablename__ = "shipments"

    shipment_id       = Column(Integer, primary_key=True, autoincrement=True)
    order_id          = Column(Integer, ForeignKey("orders.order_id"), nullable=False)
    shipper_id        = Column(Integer, ForeignKey("shippers.shipper_id"))

    # Mã đơn ship: SD-YYYYMMDD-xxxxxx (unique, sinh khi shop xác nhận đóng gói)
    delivery_code     = Column(String(30), unique=True, nullable=True, index=True)

    # Loại vận chuyển — server_default để không include vào INSERT khi chưa migrate
    shipment_type = Column(String(50), server_default='local', nullable=True)

    # Kho liên quan
    src_warehouse_id      = Column(Integer, ForeignKey("warehouses.warehouse_id"), nullable=True)
    dest_warehouse_id     = Column(Integer, ForeignKey("warehouses.warehouse_id"), nullable=True)
    # Kho đang chứa đơn hiện tại (cập nhật mỗi lần scan/chuyển kho)
    current_warehouse_id  = Column(Integer, ForeignKey("warehouses.warehouse_id"), nullable=True)

    pickup_location   = Column(String(500))
    delivery_location = Column(String(500))
    # Trạng thái chi tiết theo kế hoạch DELIVERY_CODE_PLAN.md
    # pending → packed → assigned_pickup → at_ward_warehouse → at_district_warehouse
    # → at_hub_hanoi → in_transit_interprovincial → at_hub_hcmc
    # → at_district_hcmc → at_ward_hcmc → out_for_delivery → delivered | failed
    status = Column(String(50), default="pending", index=True)
    pickup_time    = Column(DateTime)
    delivery_time  = Column(DateTime)
    current_location = Column(JSON)
    route          = Column(JSON)
    failure_reason = Column(String(500))

    # Thông tin kích thước & bậc phí (lưu khi shop confirm-packing)
    pkg_length_cm  = Column(Numeric(6, 1), nullable=True)
    pkg_width_cm   = Column(Numeric(6, 1), nullable=True)
    pkg_height_cm  = Column(Numeric(6, 1), nullable=True)
    pkg_weight_kg  = Column(Numeric(6, 2), nullable=True)
    size_tier      = Column(Integer, nullable=True)    # 1–5 hoặc 6 (quá khổ)
    extra_fee      = Column(Integer, default=0, nullable=True)

    created_at     = Column(DateTime, server_default=func.now())
    updated_at     = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_shipment_shipper", "shipper_id"),
        Index("idx_shipment_status", "status"),
    )

    # Relationships
    order             = relationship("Order", back_populates="shipment")
    shipper           = relationship("Shipper", back_populates="shipments")
    src_warehouse     = relationship("Warehouse", foreign_keys=[src_warehouse_id], back_populates="outgoing")
    dest_warehouse    = relationship("Warehouse", foreign_keys=[dest_warehouse_id], back_populates="incoming")
    current_warehouse = relationship("Warehouse", foreign_keys=[current_warehouse_id])
    logs              = relationship("ShipmentLog", back_populates="shipment", order_by="ShipmentLog.created_at")
    bundle_links      = relationship("BundleShipment", back_populates="shipment")


class ShipmentLog(Base):
    """Lịch sử di chuyển của đơn hàng qua các kho."""
    __tablename__ = "shipment_logs"

    log_id       = Column(Integer, primary_key=True, autoincrement=True)
    shipment_id  = Column(Integer, ForeignKey("shipments.shipment_id", ondelete="CASCADE"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.warehouse_id", ondelete="SET NULL"), nullable=True)
    status       = Column(String(50), nullable=False)
    note         = Column(String(300))
    created_by   = Column(Integer, ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    created_at   = Column(DateTime, server_default=func.now())

    shipment  = relationship("Shipment", back_populates="logs")
    warehouse = relationship("Warehouse", foreign_keys=[warehouse_id])
    creator   = relationship("User", foreign_keys=[created_by])


class InterProvincialBundle(Base):
    """Bundle liên tỉnh: mã LT-YYYYMMDD-HN-HCM-xxxx gom nhiều đơn SD."""
    __tablename__ = "interprovincial_bundles"

    bundle_id    = Column(Integer, primary_key=True, autoincrement=True)
    bundle_code  = Column(String(40), unique=True, nullable=False, index=True)
    src_hub_id   = Column(Integer, ForeignKey("warehouses.warehouse_id"), nullable=False)
    dest_hub_id  = Column(Integer, ForeignKey("warehouses.warehouse_id"), nullable=False)
    # pending → sealed → in_transit → arrived → distributed
    status       = Column(String(30), nullable=False, default='pending', index=True)
    total_shipments = Column(Integer, default=0)
    total_cod    = Column(Numeric(14, 2), default=0)

    created_by   = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    sealed_by    = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    sealed_at    = Column(DateTime, nullable=True)
    arrived_confirmed_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    arrived_at   = Column(DateTime, nullable=True)
    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())

    src_hub   = relationship("Warehouse", foreign_keys=[src_hub_id])
    dest_hub  = relationship("Warehouse", foreign_keys=[dest_hub_id])
    creator   = relationship("User", foreign_keys=[created_by])
    sealer    = relationship("User", foreign_keys=[sealed_by])
    shipments = relationship("BundleShipment", back_populates="bundle",
                             cascade="all, delete-orphan")


class BundleShipment(Base):
    """Liên kết N-N giữa bundle liên tỉnh và đơn ship."""
    __tablename__ = "bundle_shipments"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    bundle_id   = Column(Integer, ForeignKey("interprovincial_bundles.bundle_id", ondelete="CASCADE"), nullable=False)
    shipment_id = Column(Integer, ForeignKey("shipments.shipment_id", ondelete="CASCADE"), nullable=False)
    added_at    = Column(DateTime, server_default=func.now())

    bundle   = relationship("InterProvincialBundle", back_populates="shipments")
    shipment = relationship("Shipment", back_populates="bundle_links")


class ShipperBonus(Base):
    __tablename__ = "shipper_bonuses"

    bonus_id    = Column(Integer, primary_key=True, autoincrement=True)
    shipper_id  = Column(Integer, ForeignKey("shippers.shipper_id"), nullable=False, index=True)
    type        = Column(String(50), nullable=False)
    title       = Column(String(200), nullable=False)
    reward      = Column(Numeric(12, 2), nullable=False)
    period      = Column(String(100))
    status      = Column(Enum("received", "pending", "cancelled", native_enum=False), default="pending")
    received_at = Column(DateTime)
    created_at  = Column(DateTime, server_default=func.now())

    shipper = relationship("Shipper", foreign_keys=[shipper_id])


class ShipperTransaction(Base):
    __tablename__ = "shipper_transactions"

    txn_id      = Column(Integer, primary_key=True, autoincrement=True)
    shipper_id  = Column(Integer, ForeignKey("shippers.shipper_id"), nullable=False, index=True)
    order_id    = Column(Integer, ForeignKey("orders.order_id"), nullable=True)
    type        = Column(Enum("delivery_fee", "bonus", "adjustment", "refund", native_enum=False), nullable=False)
    amount      = Column(Numeric(12, 2), nullable=False)
    status      = Column(Enum("completed", "pending", "cancelled", native_enum=False), default="completed")
    note        = Column(String(300))
    created_at  = Column(DateTime, server_default=func.now())

    shipper = relationship("Shipper", foreign_keys=[shipper_id])


class ShipperWithdrawal(Base):
    __tablename__ = "shipper_withdrawals"

    wd_id          = Column(Integer, primary_key=True, autoincrement=True)
    shipper_id     = Column(Integer, ForeignKey("shippers.shipper_id"), nullable=False, index=True)
    amount         = Column(Numeric(12, 2), nullable=False)
    bank_name      = Column(String(100), nullable=False)
    account_number = Column(String(50), nullable=False)
    account_holder = Column(String(100))
    status         = Column(Enum("pending", "completed", "rejected", native_enum=False), default="pending")
    note           = Column(String(300))
    created_at     = Column(DateTime, server_default=func.now())
    completed_at   = Column(DateTime)

    shipper = relationship("Shipper", foreign_keys=[shipper_id])


class ShipperIncident(Base):
    __tablename__ = "shipper_incidents"

    incident_id  = Column(Integer, primary_key=True, autoincrement=True)
    shipper_id   = Column(Integer, ForeignKey("shippers.shipper_id"), nullable=False, index=True)
    order_id     = Column(Integer, ForeignKey("orders.order_id"), nullable=True)
    type         = Column(Enum("accident", "delay", "complaint", "lost_item", "other", native_enum=False), nullable=False)
    title        = Column(String(200), nullable=False)
    description  = Column(Text)
    status       = Column(Enum("open", "in_review", "resolved", "closed", native_enum=False), default="open")
    is_violation = Column(Boolean, default=False)
    support_note = Column(String(500))
    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())

    shipper = relationship("Shipper", foreign_keys=[shipper_id])
