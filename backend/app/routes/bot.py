"""
Chatbot API — POST /api/v1/bot/query
Hỗ trợ role: admin (gemini-2.5-pro), user/shop/shipper (gemini-2.5-flash).
Employee không có chatbot.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.services.bot_service import query_bot, clear_history

logger = logging.getLogger(__name__)
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

    try:
        reply = query_bot(
            message=body.message.strip(),
            role=role,
            user=current_user,
            db=db,
        )
    except Exception:
        # query_bot() đã tự bắt lỗi Gemini/tool ở bên trong — nhánh này chỉ
        # phòng hờ lỗi phát sinh ngoài dự kiến, để chat không bao giờ trả 500
        # thô cho người dùng.
        logger.exception("[bot] Lỗi không mong muốn khi xử lý /bot/query (user_id=%s)", current_user.user_id)
        reply = "⚠️ Xin lỗi, có lỗi xảy ra khi xử lý câu hỏi này. Bạn thử lại sau ít phút nhé."
    return BotQueryResponse(reply=reply, role=role)


@router.post("/clear", status_code=200)
def bot_clear_history(
    current_user: User = Depends(get_current_user),
):
    """Xóa lịch sử hội thoại của user hiện tại."""
    clear_history(current_user.user_id)
    return {"cleared": True}
