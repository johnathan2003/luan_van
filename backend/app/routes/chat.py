"""
Chat routes — hội thoại giữa Buyer và Shop.

Notification routing logic:
  - Khách gửi tin → conv chưa có NV phụ trách:
      • Thông báo owner 1 LẦN DUY NHẤT (owner_notified flag)
      • Socket new_chat_message → TẤT CẢ nhân viên có quyền message:read
  - Khách gửi tin → conv đã có NV phụ trách:
      • Socket new_chat_message → đúng NV đó
  - Shop/NV gửi tin → khách:
      • Socket new_message → khách
      • Nếu người gửi là NV (không phải owner) → auto-assign conversation
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.shop import Shop, ShopEmployee, EmployeeRolePermission
from app.models.chat import Conversation
from app.schemas.chat import (
    SendMessageRequest,
    ConversationOut,
    MessageListResponse,
    ConversationListResponse,
    MessageOut,
)
from app.services import chat_service
from app.websocket.connection_manager import send_to_user, send_to_room

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Helper: shop_id của owner ─────────────────────────────────────────────────
def _get_my_shop_id(db: Session, user_id: int) -> int:
    shop = db.query(Shop).filter_by(shop_id=user_id).first()
    if not shop:
        raise HTTPException(403, "Bạn chưa có shop hoặc shop chưa được duyệt")
    return shop.shop_id


# ── Helper: lấy employee record nếu user là nhân viên chat của shop ──────────
def _get_employee_for_shop(db: Session, user_id: int, shop_id: int):
    """
    Trả về ShopEmployee nếu user có quyền chat (message:read HOẶC message:send).
    Ghi log để dễ debug khi employee gặp lỗi 403.
    """
    emp = (
        db.query(ShopEmployee)
        .filter_by(user_id=user_id, shop_id=shop_id, status="active")
        .first()
    )
    if not emp:
        logger.debug(
            f"[chat_access] user={user_id} not in shop={shop_id} "
            f"(no active ShopEmployee record)"
        )
        return None

    perms = {p.permission_code for p in emp.permissions}
    logger.debug(f"[chat_access] user={user_id} emp={emp.employee_id} shop={shop_id} perms={perms}")

    # message:read HOẶC message:send đều đủ để vừa xem vừa reply
    if "message:read" in perms or "message:send" in perms:
        return emp

    logger.warning(
        f"[chat_access] DENIED user={user_id} emp={emp.employee_id} "
        f"thiếu message:read/message:send, chỉ có perms={perms}"
    )
    return None


# ── Helper: kiểm tra quyền truy cập conversation ─────────────────────────────
def _assert_access(db: Session, conv_id: int, user_id: int) -> Conversation:
    conv = db.query(Conversation).filter_by(conversation_id=conv_id).first()
    if not conv:
        raise HTTPException(404, "Hội thoại không tồn tại")
    if conv.user_id == user_id:
        return conv  # buyer
    if conv.shop_id == user_id:
        return conv  # shop owner
    emp = _get_employee_for_shop(db, user_id, conv.shop_id)
    if emp:
        return conv  # employee có quyền
    logger.warning(
        f"[chat_access] 403 conv={conv_id} user={user_id} "
        f"buyer={conv.user_id} shop={conv.shop_id}"
    )
    raise HTTPException(403, "Bạn không có quyền truy cập hội thoại này")


# ── Helper: lấy user_id tất cả nhân viên chat của shop ───────────────────────
def _get_chat_employee_user_ids(db: Session, shop_id: int) -> list:
    emps = db.query(ShopEmployee).filter_by(shop_id=shop_id, status="active").all()
    result = []
    for emp in emps:
        perms = {p.permission_code for p in emp.permissions}
        if "message:read" in perms or "message:send" in perms:
            result.append(emp.user_id)
    return result




# ── Buyer: mở / lấy conversation với shop ────────────────────────────────────
@router.post("/conversations/{shop_id}", response_model=ConversationOut)
def open_conversation(
    shop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop = db.query(Shop).filter_by(shop_id=shop_id).first()
    if not shop:
        raise HTTPException(404, "Shop không tồn tại")
    conv = chat_service.get_or_create_conversation(db, current_user.user_id, shop_id)
    return chat_service._conv_to_out(conv, viewer_is_user=True)


# ── Buyer: danh sách tất cả hội thoại ────────────────────────────────────────
@router.get("/conversations", response_model=ConversationListResponse)
def list_my_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    convs = chat_service.list_conversations_for_user(db, current_user.user_id)
    return {"conversations": convs, "total": len(convs)}


# ── Shop owner: inbox ─────────────────────────────────────────────────────────
@router.get("/shop/conversations", response_model=ConversationListResponse)
def shop_inbox(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shop_id = _get_my_shop_id(db, current_user.user_id)
    convs   = chat_service.list_conversations_for_shop(db, shop_id)
    return {"conversations": convs, "total": len(convs)}


# ── Employee: inbox (chưa assign + assign cho mình) ──────────────────────────
@router.get("/employee/conversations", response_model=ConversationListResponse)
def employee_inbox(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Nhân viên chat thấy: hội thoại chưa có ai nhận + hội thoại mình đang phụ trách."""
    emp_record = (
        db.query(ShopEmployee)
        .filter_by(user_id=current_user.user_id, status="active")
        .first()
    )
    if not emp_record:
        raise HTTPException(403, "Bạn không phải nhân viên của shop nào")

    perms = {p.permission_code for p in emp_record.permissions}
    if "message:read" not in perms and "message:send" not in perms:
        raise HTTPException(403, "Bạn không có quyền xem tin nhắn (cần message:read hoặc message:send)")

    shop_id = emp_record.shop_id
    convs = (
        db.query(Conversation)
        .filter(
            Conversation.shop_id == shop_id,
            or_(
                Conversation.assigned_employee_id == None,
                Conversation.assigned_employee_id == current_user.user_id,
            )
        )
        .order_by(Conversation.last_message_at.desc().nullslast())
        .all()
    )
    return {
        "conversations": [chat_service._conv_to_out(c, viewer_is_user=False) for c in convs],
        "total": len(convs),
    }


# ── Employee: nhận phụ trách conversation ────────────────────────────────────
@router.post("/conversations/{conv_id}/assign")
async def assign_conversation(
    conv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = db.query(Conversation).filter_by(conversation_id=conv_id).first()
    if not conv:
        raise HTTPException(404, "Hội thoại không tồn tại")

    emp = _get_employee_for_shop(db, current_user.user_id, conv.shop_id)
    if not emp:
        raise HTTPException(403, "Bạn không có quyền nhận hội thoại này")

    if conv.assigned_employee_id and conv.assigned_employee_id != current_user.user_id:
        raise HTTPException(400, "Hội thoại này đã được nhân viên khác phụ trách")

    conv.assigned_employee_id = current_user.user_id
    db.commit()

    await send_to_room(f"conv_{conv_id}", "conv_assigned", {
        "conversation_id":  conv_id,
        "employee_id":      current_user.user_id,
        "employee_name":    current_user.full_name,
    })

    return {"message": f"Đã nhận phụ trách cuộc hội thoại #{conv_id}"}


# ── Lịch sử tin nhắn ─────────────────────────────────────────────────────────
@router.get("/conversations/{conv_id}/messages", response_model=MessageListResponse)
def get_messages(
    conv_id:   int,
    before_id: int  = Query(None),
    limit:     int  = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_access(db, conv_id, current_user.user_id)
    msgs, has_more = chat_service.get_messages(db, conv_id, before_id, limit)
    return {"messages": msgs, "total": len(msgs), "has_more": has_more}


# ── Gửi tin nhắn (async để await socket emit trực tiếp — không cần fire()) ───
@router.post("/conversations/{conv_id}/messages", response_model=MessageOut, status_code=201)
async def send_message(
    conv_id: int,
    body: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = _assert_access(db, conv_id, current_user.user_id)

    is_buyer    = (current_user.user_id == conv.user_id)
    sender_role = "user" if is_buyer else "shop"

    msg = chat_service.send_message(
        db, conv_id, current_user.user_id, sender_role, body.content, body.image_url
    )

    payload = {
        "conversation_id": conv_id,
        "message": {
            "message_id":    msg.message_id,
            "sender_id":     msg.sender_id,
            "sender_role":   msg.sender_role,
            "sender_name":   msg.sender_name,
            "sender_avatar": msg.sender_avatar,
            "content":       msg.content,
            "image_url":     msg.image_url,
            "created_at":    msg.created_at.isoformat(),
        },
    }

    # ── Lưu các giá trị cần thiết TRƯỚC khi chat_service commit làm expire conv ──
    # Sau db.commit() trong send_message service, SQLAlchemy expire conv.
    # Lazy-reload có thể fail trong một số trường hợp connection pool → store trước.
    buyer_user_id        = conv.user_id
    shop_owner_id        = conv.shop_id
    assigned_employee_id = conv.assigned_employee_id

    logger.info(
        f"[send_message] conv={conv_id} sender={current_user.user_id} "
        f"is_buyer={is_buyer} buyer={buyer_user_id} shop={shop_owner_id}"
    )

    # Broadcast vào conversation room (ai đang mở conv đều nhận)
    await send_to_room(f"conv_{conv_id}", "new_message", payload)
    logger.info(f"[send_message] emitted new_message → room conv_{conv_id}")

    if is_buyer:
        await _route_to_shop(db, conv, msg, current_user, payload,
                             shop_owner_id, assigned_employee_id)
    else:
        # Shop/NV gửi → notify buyer trực tiếp qua user room
        await send_to_user(buyer_user_id, "new_message", payload)
        logger.info(f"[send_message] emitted new_message → user_{buyer_user_id}")
        # Auto-assign nếu người gửi là nhân viên (không phải owner)
        is_owner = (current_user.user_id == shop_owner_id)
        if not is_owner and assigned_employee_id != current_user.user_id:
            conv.assigned_employee_id = current_user.user_id
            db.commit()

    return msg


# ── Đánh dấu đã đọc ──────────────────────────────────────────────────────────
@router.put("/conversations/{conv_id}/read")
def mark_read(
    conv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = _assert_access(db, conv_id, current_user.user_id)
    reader_role = "user" if current_user.user_id == conv.user_id else "shop"
    count = chat_service.mark_messages_read(db, conv_id, reader_role)
    return {"marked_read": count}


# ── Routing notifications khi khách gửi (async) ──────────────────────────────
async def _route_to_shop(
    db: Session,
    conv: Conversation,
    msg,
    sender_user: User,
    payload: dict,
    shop_owner_id: int,         # truyền vào để tránh lazy-load sau expire
    assigned_employee_id: int | None,
):
    from app.services.notification_service import create_notification

    if assigned_employee_id:
        # Đã có NV phụ trách — notify NV đó
        await send_to_user(assigned_employee_id, "new_chat_message", payload)
        # Cũng notify owner để inbox shop cập nhật (owner vẫn cần biết)
        await send_to_user(shop_owner_id, "new_chat_message", payload)
        return

    # Chưa có NV — thông báo owner 1 lần duy nhất (DB notification)
    if not conv.owner_notified:
        create_notification(
            db,
            user_id             = shop_owner_id,
            title               = "💬 Khách hàng cần hỗ trợ",
            message             = f"{sender_user.full_name or 'Khách'} vừa nhắn tin cho shop của bạn",
            notif_type          = "chat",
            related_entity_type = "conversation",
            related_entity_id   = conv.conversation_id,
            action_url          = f"/shop/chat?conv={conv.conversation_id}",
        )
        conv.owner_notified = True
        db.commit()

    # Socket tới tất cả nhân viên chat đang online
    for emp_uid in _get_chat_employee_user_ids(db, shop_owner_id):
        await send_to_user(emp_uid, "new_chat_message", payload)

    # Notify owner qua socket để inbox shop cập nhật
    await send_to_user(shop_owner_id, "new_chat_message", payload)
