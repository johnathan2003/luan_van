"""
feedback.py — [F-1]
User gửi phản hồi / góp ý đến admin.
Admin xem và xử lý qua admin.py (đã có sẵn).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.admin_config import Feedback

router = APIRouter()


class FeedbackCreate(BaseModel):
    subject: str
    content: str
    type: Optional[str] = "other"   # bug | complaint | suggestion | praise | other


@router.post("", status_code=201)
def submit_feedback(
    data: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """[F-1] User (hoặc khách) gửi phản hồi đến admin."""
    if not data.subject.strip() or not data.content.strip():
        raise HTTPException(status_code=400, detail="Tiêu đề và nội dung không được để trống")

    fb = Feedback(
        user_id=current_user.user_id if current_user else None,
        user_name=current_user.full_name if current_user else "Khách",
        user_email=current_user.email if current_user else None,
        subject=data.subject.strip(),
        content=data.content.strip(),
        type=data.type or "other",
        status="open",
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return {"message": "Cảm ơn bạn đã gửi phản hồi!", "feedback_id": fb.feedback_id}
