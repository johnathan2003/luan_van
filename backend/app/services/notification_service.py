from sqlalchemy.orm import Session
from app.models.notification import Notification, NotificationPreference
from app.websocket.connection_manager import send_to_user
from app.utils.helpers import paginate
import asyncio
import logging

logger = logging.getLogger(__name__)


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notif_type: str = None,
    related_entity_type: str = None,
    related_entity_id: int = None,
    action_url: str = None,
    data: dict = None,
) -> Notification:
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notif_type,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
        action_url=action_url,
        data=data,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    # Send real-time
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(send_to_user(user_id, "notification", {
                "notification_id": notif.notification_id,
                "title": title,
                "message": message,
                "type": notif_type,
                "data": data,
            }))
    except Exception as e:
        logger.error(f"Failed to send real-time notification: {e}")

    return notif


def get_user_notifications(db: Session, user_id: int, page: int = 1, limit: int = 20):
    query = db.query(Notification).filter(
        Notification.user_id == user_id
    ).order_by(Notification.created_at.desc())
    items, total, pages = paginate(query, page, limit)
    unread_count = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False,
    ).count()
    return items, total, pages, unread_count


def mark_as_read(db: Session, notification_id: int, user_id: int):
    from datetime import datetime
    notif = db.query(Notification).filter(
        Notification.notification_id == notification_id,
        Notification.user_id == user_id,
    ).first()
    if notif:
        notif.is_read = True
        notif.read_at = datetime.utcnow()
        db.commit()


def mark_all_as_read(db: Session, user_id: int):
    from datetime import datetime
    db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False,
    ).update({"is_read": True, "read_at": datetime.utcnow()})
    db.commit()


def delete_notification(db: Session, notification_id: int, user_id: int):
    notif = db.query(Notification).filter(
        Notification.notification_id == notification_id,
        Notification.user_id == user_id,
    ).first()
    if notif:
        db.delete(notif)
        db.commit()
