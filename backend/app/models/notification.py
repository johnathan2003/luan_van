from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON, Time, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    notification_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50))
    related_entity_type = Column(String(50))
    related_entity_id = Column(Integer)
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime)
    action_url = Column(String(500))
    data = Column(JSON)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_notif_user_created", "user_id", "created_at"),
        Index("idx_notif_user_read", "user_id", "is_read"),
    )

    # Relationships
    user = relationship("User", back_populates="notifications", foreign_keys=[user_id])


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    pref_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, unique=True)
    email_notifications = Column(Boolean, default=True)
    sms_notifications = Column(Boolean, default=False)
    push_notifications = Column(Boolean, default=True)
    notification_types = Column(JSON)
    quiet_hours_start = Column(Time)
    quiet_hours_end = Column(Time)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
