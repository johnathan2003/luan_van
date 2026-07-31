"""
Chatbot API — POST /api/v1/bot/query
Hỗ trợ role: admin (gemini-1.5-pro), user/shop/shipper (gemini-1.5-flash).
Employee không có chatbot.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.services.bot_service import query_bot

router = APIRouter()

SUPPORTED_ROLES = {"admin", "user", "shop", "shipper"}


class BotQueryRequest(BaseModel):
    message: str


class BotQueryResponse(BaseModel):
    reply: str
    role: str


@router.post("/query", response_model=BotQueryResponse)
def bot_query(
    body: BotQueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Tin nhắn không được để trống")

    # Determine active role
    active_roles = {
        ur.role.role_name
        for ur in current_user.user_roles
        if ur.status == "active" and ur.role
    }
    # Pick highest-privilege role
    role = None
    for r in ("admin", "shop", "shipper", "user"):
        if r in active_roles:
            role = r
            break

    if role not in SUPPORTED_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Vai trò của bạn chưa được hỗ trợ chatbot",
        )

    reply = query_bot(
        message=body.message.strip(),
        role=role,
        user=current_user,
        db=db,
    )
    return BotQueryResponse(reply=reply, role=role)
