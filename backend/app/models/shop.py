from sqlalchemy import Column, Integer, String, Text, Enum, Boolean, DateTime, ForeignKey, Date, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Shop(Base):
    __tablename__ = "shops"

    shop_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    shop_name = Column(String(255), nullable=False)
    description = Column(Text)
    avatar_url = Column(String(500))
    address = Column(Text, nullable=False)
    phone = Column(String(20))
    rating = Column(String(5), default="0.00")
    total_followers = Column(Integer, default=0)
    total_orders = Column(Integer, default=0)
    verification_status = Column(Enum("pending", "approved", "rejected"), default="pending", index=True)
    verified_at = Column(DateTime)
    # Mall tier: shop được xét duyệt lên BuyZo Mall
    is_mall          = Column(Boolean, default=False, nullable=False)
    mall_request_status = Column(Enum("none", "pending", "approved", "rejected"), default="none")
    mall_requested_at   = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    owner = relationship("User", back_populates="shop", foreign_keys=[shop_id])
    employees = relationship("ShopEmployee", back_populates="shop", foreign_keys="ShopEmployee.shop_id")
    products = relationship("Product", back_populates="shop", foreign_keys="Product.shop_id")


class ShopRegistration(Base):
    __tablename__ = "shop_registrations"

    reg_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, unique=True)
    shop_name = Column(String(255), nullable=False)
    description = Column(Text)
    address = Column(Text, nullable=False)
    cmnd_url = Column(String(500))
    cmnd_back_url = Column(String(500))
    business_reg_url = Column(String(500))
    status = Column(Enum("pending", "approved", "rejected"), default="pending", index=True)
    rejection_reason = Column(Text)
    reviewed_by = Column(Integer, ForeignKey("users.user_id"))
    reviewed_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])


class ShopEmployee(Base):
    __tablename__ = "shop_employees"

    employee_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, unique=True)
    shop_id = Column(Integer, ForeignKey("shops.shop_id"), nullable=False)
    employee_name = Column(String(255))
    position = Column(String(100))
    status = Column(Enum("active", "inactive", "suspended"), default="active", index=True)
    hired_date = Column(Date)
    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_shop_employee", "shop_id"),
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    shop = relationship("Shop", back_populates="employees", foreign_keys=[shop_id])
    creator = relationship("User", foreign_keys=[created_by])
    permissions = relationship("EmployeeRolePermission", back_populates="employee", cascade="all, delete-orphan")


class EmployeeRolePermission(Base):
    __tablename__ = "employee_role_permissions"

    emp_perm_id = Column(Integer, primary_key=True, autoincrement=True)
    employee_id = Column(Integer, ForeignKey("shop_employees.employee_id"), nullable=False)
    permission_code = Column(String(100), nullable=False)
    granted_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    granted_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_emp_permission", "employee_id"),
    )

    # Relationships
    employee = relationship("ShopEmployee", back_populates="permissions")
    granter = relationship("User", foreign_keys=[granted_by])


class SystemEmployee(Base):
    __tablename__ = "system_employees"

    emp_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, unique=True)
    emp_name = Column(String(255))
    role_name = Column(String(50))
    status = Column(Enum("active", "inactive", "suspended"), default="active", index=True)
    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    creator = relationship("User", foreign_keys=[created_by])
    permissions = relationship("SystemEmployeePermission", back_populates="employee", cascade="all, delete-orphan")


class SystemEmployeePermission(Base):
    __tablename__ = "system_employee_permissions"

    emp_perm_id = Column(Integer, primary_key=True, autoincrement=True)
    emp_id = Column(Integer, ForeignKey("system_employees.emp_id"), nullable=False)
    permission_code = Column(String(100))
    scope = Column(Enum("admin", "shop", "both"), default="admin")
    granted_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    granted_at = Column(DateTime, server_default=func.now())

    # Relationships
    employee = relationship("SystemEmployee", back_populates="permissions")
    granter = relationship("User", foreign_keys=[granted_by])
