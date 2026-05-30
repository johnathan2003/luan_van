from sqlalchemy import Column, Integer, String, Text, Enum, Boolean, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255))
    phone = Column(String(20))
    address = Column(Text)
    avatar_url = Column(String(500))
    status = Column(Enum("active", "inactive", "banned"), default="active", index=True)
    last_login = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user_roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
    shop = relationship("Shop", back_populates="owner", uselist=False, foreign_keys="Shop.shop_id")
    shipper = relationship("Shipper", back_populates="user", uselist=False, foreign_keys="Shipper.shipper_id")
    notifications = relationship("Notification", back_populates="user", foreign_keys="Notification.user_id")
    orders = relationship("Order", back_populates="user", foreign_keys="Order.user_id")
    cart_items = relationship("Cart", back_populates="user")


class Role(Base):
    __tablename__ = "roles"

    role_id = Column(Integer, primary_key=True, autoincrement=True)
    role_name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    user_roles = relationship("UserRole", back_populates="role")
    role_permissions = relationship("RolePermission", back_populates="role")


class UserRole(Base):
    __tablename__ = "user_roles"

    user_role_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.role_id"), nullable=False)
    status = Column(Enum("active", "inactive"), default="active")
    current_role = Column(Boolean, default=False)
    assigned_by = Column(Integer, ForeignKey("users.user_id"))
    assigned_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "role_id", name="unique_user_role"),
        Index("idx_current_role", "user_id", "current_role"),
    )

    # Relationships
    user = relationship("User", back_populates="user_roles", foreign_keys=[user_id])
    role = relationship("Role", back_populates="user_roles")


class Permission(Base):
    __tablename__ = "permissions"

    permission_id = Column(Integer, primary_key=True, autoincrement=True)
    permission_code = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    category = Column(String(50))
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    role_permissions = relationship("RolePermission", back_populates="permission")


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_perm_id = Column(Integer, primary_key=True, autoincrement=True)
    role_id = Column(Integer, ForeignKey("roles.role_id"), nullable=False)
    permission_id = Column(Integer, ForeignKey("permissions.permission_id"), nullable=False)

    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="unique_role_permission"),
    )

    # Relationships
    role = relationship("Role", back_populates="role_permissions")
    permission = relationship("Permission", back_populates="role_permissions")
