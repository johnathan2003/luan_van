from sqlalchemy import Column, Integer, String, Text, Enum, DateTime, ForeignKey, JSON, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class EmployeeActivityLog(Base):
    __tablename__ = "employee_activity_logs"

    log_id = Column(Integer, primary_key=True, autoincrement=True)
    employee_id = Column(Integer)
    employee_type = Column(Enum("shop", "system"), default="shop")
    action = Column(String(100))
    entity_type = Column(String(50))
    entity_id = Column(Integer)
    details = Column(JSON)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_emp_log_employee", "employee_id"),
        Index("idx_emp_log_created", "created_at"),
    )


class AdminLog(Base):
    __tablename__ = "admin_logs"

    log_id = Column(Integer, primary_key=True, autoincrement=True)
    admin_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    action = Column(String(100))
    target_type = Column(String(50))
    target_id = Column(Integer)
    details = Column(JSON)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_admin_log_admin", "admin_id"),
        Index("idx_admin_log_created", "created_at"),
    )

    # Relationships
    admin = relationship("User", foreign_keys=[admin_id])


class SystemLog(Base):
    __tablename__ = "system_logs"

    log_id = Column(Integer, primary_key=True, autoincrement=True)
    level = Column(Enum("info", "warning", "error", "critical"), index=True)
    message = Column(Text)
    context = Column(JSON)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_sys_log_level", "level"),
        Index("idx_sys_log_created", "created_at"),
    )
