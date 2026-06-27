from enum import Enum


class RoleName(str, Enum):
    USER = "user"
    SHOP = "shop"
    SHIPPER = "shipper"
    ADMIN = "admin"
    SUPERADMIN = "superadmin"
    EMPLOYEE = "employee"


class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    READY_TO_SHIP = "ready_to_ship"
    SHIPPING = "shipping"
    DELIVERED = "delivered"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PaymentStatus(str, Enum):
    UNPAID = "unpaid"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"


class PaymentMethod(str, Enum):
    MOMO = "momo"
    COD = "cod"
    VNPAY = "vnpay"


class ShipmentStatus(str, Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    PICKED_UP = "picked_up"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    FAILED = "failed"


class ProductStatus(str, Enum):
    ACTIVE = "active"
    PENDING = "pending"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    BANNED = "banned"


class ShipperStatus(str, Enum):
    AVAILABLE = "available"
    ON_DELIVERY = "on_delivery"
    OFFLINE = "offline"


class PermissionCode(str, Enum):
    PRODUCT_CREATE = "product:create"
    PRODUCT_READ = "product:read"
    PRODUCT_UPDATE = "product:update"
    PRODUCT_DELETE = "product:delete"
    PRODUCT_APPROVE = "product:approve"
    ORDER_CREATE = "order:create"
    ORDER_READ = "order:read"
    ORDER_CONFIRM = "order:confirm"
    ORDER_CANCEL = "order:cancel"
    ORDER_UPDATE = "order:update"
    SHOP_MANAGE = "shop:manage"
    SHOP_ANALYTICS = "shop:analytics"
    SHOP_EMPLOYEES = "shop:employees"
    MESSAGE_READ = "message:read"
    MESSAGE_SEND = "message:send"
    USER_MANAGE = "user:manage"
    USER_BAN = "user:ban"
    DISPUTE_RESOLVE = "dispute:resolve"
    PAYMENT_PROCESS = "payment:process"
    SHIPMENT_READ = "shipment:read"
    SHIPMENT_ASSIGN = "shipment:assign"


class NotificationType(str, Enum):
    ORDER_CREATED = "order_created"
    ORDER_CONFIRMED = "order_confirmed"
    ORDER_READY = "order_ready_to_ship"
    ORDER_SHIPPING = "order_shipping"
    ORDER_DELIVERED = "order_delivered"
    ORDER_COMPLETED = "order_completed"
    ORDER_CANCELLED = "order_cancelled"
    PAYMENT_SUCCESS = "payment_success"
    PAYMENT_FAILED = "payment_failed"
    SHOP_APPROVED = "shop_approved"
    SHOP_REJECTED = "shop_rejected"
    SHIPPER_APPROVED = "shipper_approved"
    PRODUCT_APPROVED = "product_approved"
    PRODUCT_REJECTED = "product_rejected"
    DELETION_REQUEST = "deletion_request"


DEFAULT_ROLES = ["user", "shop", "shipper", "admin", "superadmin", "employee"]

DEFAULT_PERMISSIONS = [
    ("product:create", "product", "Create product"),
    ("product:read", "product", "View products"),
    ("product:update", "product", "Edit product"),
    ("product:delete", "product", "Delete product"),
    ("product:approve", "product", "Approve product"),
    ("order:create", "order", "Create order"),
    ("order:read", "order", "View orders"),
    ("order:confirm", "order", "Confirm order"),
    ("order:cancel", "order", "Cancel order"),
    ("order:update", "order", "Update order"),
    ("shop:manage", "shop", "Manage shop"),
    ("shop:analytics", "shop", "View analytics"),
    ("shop:employees", "shop", "Manage employees"),
    ("message:read", "message", "Read messages"),
    ("message:send", "message", "Send messages"),
    ("user:manage", "user", "Manage users"),
    ("user:ban", "user", "Ban users"),
    ("dispute:resolve", "dispute", "Resolve disputes"),
    ("payment:process", "payment", "Process payment"),
    ("shipment:read", "shipment", "View shipments"),
    ("shipment:assign", "shipment", "Assign shipper"),
]
