"""
Chatbot service — FastAPI app riêng, tách khỏi backend thương mại điện tử
chính (2026-08-04). Chạy độc lập ở port 8002.

Lý do tách ra:
- Chuẩn bị cho thiết bị IoT (ESP32-S3, có mic + loa) gọi thẳng vào chatbot
  này qua HTTP/WebSocket sau này, không phải đụng vào backend chính.
- Nếu chatbot lỗi/hết quota Gemini, không ảnh hưởng tới các API mua bán
  chính (đặt hàng, thanh toán, quản lý shop...).

Kiến trúc: chatbot dùng CHUNG database + Redis với backend (không tách dữ
liệu), nên vẫn cần model SQLAlchemy của backend. Thay vì copy trùng lặp các
file model (dễ lệch pha khi backend đổi schema), container này mount
`backend/app` (read-only) vào `./backend_app/app` — xem docker-compose.yml
— rồi thêm `backend_app` vào sys.path để `import app.models...`,
`app.database`, `app.config`, `app.middleware.auth` hoạt động y hệt trong
backend chính.
"""
import os
import sys
import logging

# ── Trỏ sys.path tới bản mount read-only của backend/app trước khi import
# bất cứ gì từ package `app.*` ──────────────────────────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend_app"))

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User

from bot_service import query_bot, clear_history

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
logger = logging.getLogger(__name__)

# Import trọn package models 1 lần khi khởi động để SQLAlchemy đăng ký đủ
# mapper cho các relationship() tham chiếu chéo giữa các model — tránh lỗi
# "failed to locate a name" khi 1 tool nào đó chỉ import lẻ 1 model.
import app.models  # noqa: E402,F401
try:
    import app.models.wallet_auction  # noqa: E402,F401  (không nằm trong app/models/__init__.py)
except Exception:
    logger.warning("Không import được app.models.wallet_auction — tool shop_get_wallet_balance có thể lỗi")

app = FastAPI(title="BuyZo Chatbot Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS_LIST,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPPORTED_ROLES = {"admin", "user", "shop", "shipper"}


class BotQueryRequest(BaseModel):
    message: str


class BotQueryResponse(BaseModel):
    reply: str
    role: str


@app.get("/health")
def health():
    return {"status": "ok", "service": "chatbot"}


@app.post("/api/v1/bot/query", response_model=BotQueryResponse)
def bot_query(
    body: BotQueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Tin nhắn không được để trống")

    # Determine active role (giống hệt logic cũ ở backend/app/routes/bot.py)
    active_roles = {
        ur.role.role_name
        for ur in current_user.user_roles
        if ur.status == "active" and ur.role
    }
    role = None
    for r in ("admin", "shop", "shipper", "user"):
        if r in active_roles:
            role = r
            break

    if role not in SUPPORTED_ROLES:
        raise HTTPException(status_code=403, detail="Vai trò của bạn chưa được hỗ trợ chatbot")

    try:
        reply = query_bot(message=body.message.strip(), role=role, user=current_user, db=db)
    except Exception:
        logger.exception("[bot] Lỗi không mong muốn khi xử lý /bot/query (user_id=%s)", current_user.user_id)
        reply = "⚠️ Xin lỗi, có lỗi xảy ra khi xử lý câu hỏi này. Bạn thử lại sau ít phút nhé."
    return BotQueryResponse(reply=reply, role=role)


@app.post("/api/v1/bot/clear", status_code=200)
def bot_clear_history(current_user: User = Depends(get_current_user)):
    clear_history(current_user.user_id)
    return {"cleared": True}
