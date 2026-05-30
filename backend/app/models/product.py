from sqlalchemy import Column, Integer, String, Text, Enum, DateTime, ForeignKey, JSON, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ProductCategory(Base):
    __tablename__ = "product_categories"

    category_id = Column(Integer, primary_key=True, autoincrement=True)
    category_name = Column(String(255), unique=True, nullable=False)
    description = Column(Text)
    icon_url = Column(String(500))
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    product_id = Column(Integer, primary_key=True, autoincrement=True)
    shop_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    category_id = Column(Integer, ForeignKey("product_categories.category_id"))
    product_name = Column(String(255), nullable=False)
    description = Column(Text)
    price = Column(String(15), nullable=False)
    cost = Column(String(15))
    stock_quantity = Column(Integer, default=0)
    image_urls = Column(JSON)
    status = Column(Enum("active", "pending", "rejected", "archived"), default="pending", index=True)
    rating = Column(String(5), default="0.00")
    total_reviews = Column(Integer, default=0)
    views_count = Column(Integer, default=0)
    sales_count = Column(Integer, default=0)
    deleted_at = Column(DateTime)
    deleted_by = Column(Integer, ForeignKey("users.user_id"))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_product_shop", "shop_id"),
        Index("idx_product_status", "status"),
        Index("idx_product_category", "category_id"),
    )

    # Relationships
    shop = relationship("Shop", back_populates="products", foreign_keys=[shop_id])
    category = relationship("ProductCategory", back_populates="products")
    deleter = relationship("User", foreign_keys=[deleted_by])
    order_items = relationship("OrderItem", back_populates="product")
    cart_items = relationship("Cart", back_populates="product")
    deletion_requests = relationship("ProductDeletionRequest", back_populates="product")


class StockReservation(Base):
    __tablename__ = "stock_reservations"

    reservation_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    reserved_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime)
    status = Column(Enum("reserved", "cancelled", "used"), default="reserved", index=True)

    # Relationships
    order = relationship("Order")
    product = relationship("Product")


class ProductDeletionRequest(Base):
    __tablename__ = "product_deletion_requests"

    deletion_req_id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    shop_id = Column(Integer, ForeignKey("users.user_id"))
    requested_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    reason = Column(Text)
    status = Column(Enum("pending", "approved", "rejected"), default="pending", index=True)
    reviewed_by = Column(Integer, ForeignKey("users.user_id"))
    reviewed_at = Column(DateTime)
    review_reason = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    product = relationship("Product", back_populates="deletion_requests")
    requester = relationship("User", foreign_keys=[requested_by])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    shop_owner = relationship("User", foreign_keys=[shop_id])


class ProductDeletionAuditLog(Base):
    __tablename__ = "product_deletion_audit_log"

    audit_id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, nullable=False)
    product_name = Column(String(255))
    shop_id = Column(Integer, ForeignKey("users.user_id"))
    deleted_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    deletion_type = Column(Enum("direct", "request_approved"), default="direct")
    reason = Column(Text)
    request_id = Column(Integer, ForeignKey("product_deletion_requests.deletion_req_id"))
    deleted_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_audit_shop", "shop_id"),
        Index("idx_audit_deleted_at", "deleted_at"),
    )

    # Relationships
    deleter = relationship("User", foreign_keys=[deleted_by])
    deletion_request = relationship("ProductDeletionRequest")
