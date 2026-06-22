from sqlalchemy import Column, Integer, String, Text, Enum, DateTime, ForeignKey, JSON, Index, Numeric, Boolean
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
    shop_id = Column(Integer, ForeignKey("shops.shop_id"), nullable=False)
    category_id = Column(Integer, ForeignKey("product_categories.category_id"))
    product_name = Column(String(255), nullable=False)
    description = Column(Text)
    # Prisma schema: price Decimal(10,2) — đổi từ String sang Numeric
    price = Column(Numeric(10, 2), nullable=False)
    cost = Column(Numeric(10, 2))
    stock_quantity = Column(Integer, default=0)
    image_urls = Column(JSON)
    status = Column(Enum("active", "pending", "rejected", "archived"), default="pending", index=True)
    # rating, reviews — giữ lại cho tính năng reviews
    rating = Column(Numeric(3, 2), default=0.00)
    total_reviews = Column(Integer, default=0)
    views_count = Column(Integer, default=0)
    sales_count = Column(Integer, default=0)
    approved_at = Column(DateTime)           # Prisma: approvedAt
    deleted_at = Column(DateTime)
    deleted_by = Column(Integer, ForeignKey("users.user_id"))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_product_shop", "shop_id"),
        Index("idx_product_status", "status"),
        Index("idx_product_category", "category_id"),
        Index("idx_product_created", "created_at"),
    )

    # Relationships
    shop = relationship("Shop", back_populates="products", foreign_keys=[shop_id])
    category = relationship("ProductCategory", back_populates="products")
    deleter = relationship("User", foreign_keys=[deleted_by])
    order_items = relationship("OrderItem", back_populates="product")
    cart_items = relationship("Cart", back_populates="product")
    deletion_requests = relationship("ProductDeletionRequest", back_populates="product")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    reviews = relationship("ProductReview", back_populates="product", cascade="all, delete-orphan")


# ── Prisma: ProductVariant (mới) ──────────────────────────────────────────────
class ProductVariant(Base):
    """Biến thể sản phẩm: size, màu sắc, v.v. Mỗi variant có giá & stock riêng."""
    __tablename__ = "product_variants"

    variant_id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.product_id", ondelete="CASCADE"), nullable=False)
    variant_name = Column(String(255), nullable=False)   # Ví dụ: "Màu đỏ - Size M"
    sku = Column(String(100), nullable=False, index=True) # Stock Keeping Unit
    price = Column(Numeric(10, 2), nullable=False)
    stock = Column(Integer, default=0)
    image_url = Column(String(500))
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_variant_product", "product_id"),
    )

    # Relationships
    product = relationship("Product", back_populates="variants")


# ── Prisma: ProductReview (mới) ───────────────────────────────────────────────
class ProductReview(Base):
    """Đánh giá sản phẩm sau khi mua hàng thành công."""
    __tablename__ = "product_reviews"

    review_id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.product_id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    rating = Column(Integer, nullable=False)   # 1-5 sao
    title = Column(String(255))
    content = Column(Text)
    verified = Column(Boolean, default=False)  # Đã mua hàng xác thực
    helpful = Column(Integer, default=0)       # Số lượt thấy hữu ích
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_review_product", "product_id"),
        Index("idx_review_user", "user_id"),
    )

    # Relationships
    product = relationship("Product", back_populates="reviews")
    user = relationship("User", foreign_keys=[user_id])


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
