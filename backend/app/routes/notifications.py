from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.services.notification_service import (
    get_user_notifications, mark_as_read, mark_all_as_read, delete_notification,
)

router = APIRouter()


@router.get("")
def get_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items, total, pages, unread_count = get_user_notifications(db, current_user.user_id, page, limit)
    return {
        "notifications": [
            {
                "notification_id": n.notification_id,
                "title": n.title,
                "message": n.message,
                "type": n.type,
                "is_read": n.is_read,
                "action_url": n.action_url,
                "related_entity_type": n.related_entity_type,
                "related_entity_id": n.related_entity_id,
                "created_at": str(n.created_at),
            }
            for n in items
        ],
        "unread_count": unread_count,
        "total": total,
        "page": page,
        "pages": pages,
    }


@router.put("/{notification_id}/read")
def read_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    mark_as_read(db, notification_id, current_user.user_id)
    return {"message": "Marked as read"}


@router.put("/read-all")
def read_all(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    mark_all_as_read(db, current_user.user_id)
    return {"message": "All notifications marked as read"}


@router.delete("/{notification_id}")
def delete_notif(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    delete_notification(db, notification_id, current_user.user_id)
    return {"message": "Notification deleted"}
