from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.chat import Conversation, Message
from app.models.user import User
from app.models.shop import Shop
from app.schemas.chat import ConversationOut, MessageOut
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _conv_to_out(conv: Conversation, viewer_is_user: bool) -> ConversationOut:
    """Chuyển Conversation model → ConversationOut, điền partner info."""
    if viewer_is_user:
        partner_name   = conv.shop.shop_name   if conv.shop   else None
        partner_avatar = conv.shop.avatar_url  if conv.shop   else None
        unread         = conv.unread_by_user
    else:
        partner_name   = conv.user.full_name   if conv.user   else None
        partner_avatar = conv.user.avatar_url  if conv.user   else None
        unread         = conv.unread_by_shop

    assigned_emp_name = None
    if getattr(conv, 'assigned_employee_id', None) and getattr(conv, 'assigned_employee', None):
        assigned_emp_name = conv.assigned_employee.full_name

    return ConversationOut(
        conversation_id        = conv.conversation_id,
        user_id                = conv.user_id,
        shop_id                = conv.shop_id,
        partner_name           = partner_name,
        partner_avatar         = partner_avatar,
        last_message           = conv.last_message,
        last_message_at        = conv.last_message_at,
        unread_count           = unread,
        assigned_employee_id   = getattr(conv, 'assigned_employee_id', None),
        assigned_employee_name = assigned_emp_name,
        owner_notified         = getattr(conv, 'owner_notified', False),
        created_at             = conv.created_at,
    )


def _msg_to_out(msg: Message) -> MessageOut:
    sender_name   = msg.sender.full_name  if msg.sender else None
    sender_avatar = msg.sender.avatar_url if msg.sender else None
    return MessageOut(
        message_id      = msg.message_id,
        conversation_id = msg.conversation_id,
        sender_id       = msg.sender_id,
        sender_role     = msg.sender_role,
        sender_name     = sender_name,
        sender_avatar   = sender_avatar,
        content         = msg.content,
        image_url       = msg.image_url,
        is_read         = msg.is_read,
        read_at         = msg.read_at,
        created_at      = msg.created_at,
    )


# ── Conversation ──────────────────────────────────────────────────────────────

def get_or_create_conversation(db: Session, user_id: int, shop_id: int) -> Conversation:
    """Lấy hoặc tạo mới conversation giữa user và shop."""
    conv = db.query(Conversation).filter_by(user_id=user_id, shop_id=shop_id).first()
    if not conv:
        conv = Conversation(user_id=user_id, shop_id=shop_id)
        db.add(conv)
        db.commit()
        db.refresh(conv)
    return conv


def list_conversations_for_user(db: Session, user_id: int) -> List[ConversationOut]:
    """Tất cả hội thoại của buyer."""
    convs = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.last_message_at.desc().nullslast())
        .all()
    )
    return [_conv_to_out(c, viewer_is_user=True) for c in convs]


def list_conversations_for_shop(db: Session, shop_id: int) -> List[ConversationOut]:
    """Tất cả hội thoại của shop (inbox)."""
    convs = (
        db.query(Conversation)
        .filter(Conversation.shop_id == shop_id)
        .order_by(Conversation.last_message_at.desc().nullslast())
        .all()
    )
    return [_conv_to_out(c, viewer_is_user=False) for c in convs]


# ── Messages ──────────────────────────────────────────────────────────────────

def get_messages(
    db: Session,
    conversation_id: int,
    before_id: Optional[int] = None,
    limit: int = 30,
) -> tuple[List[MessageOut], bool]:
    """
    Lấy tin nhắn trong conversation theo cursor (before_id).
    Trả về (messages, has_more).
    """
    q = db.query(Message).filter(Message.conversation_id == conversation_id)
    if before_id:
        q = q.filter(Message.message_id < before_id)
    total_q = q.count()
    msgs = q.order_by(Message.message_id.desc()).limit(limit + 1).all()
    has_more = len(msgs) > limit
    msgs = msgs[:limit]
    msgs.reverse()   # chronological order
    return [_msg_to_out(m) for m in msgs], has_more


def send_message(
    db: Session,
    conversation_id: int,
    sender_id: int,
    sender_role: str,     # 'user' | 'shop'
    content: str,
    image_url: Optional[str] = None,
) -> MessageOut:
    """Lưu tin nhắn mới, cập nhật cache conversation."""
    msg = Message(
        conversation_id = conversation_id,
        sender_id       = sender_id,
        sender_role     = sender_role,
        content         = content,
        image_url       = image_url,
    )
    db.add(msg)

    # Cập nhật last_message + unread_count phía đối phương
    conv = db.query(Conversation).filter_by(conversation_id=conversation_id).first()
    if conv:
        conv.last_message    = content[:200]
        conv.last_message_at = msg.created_at
        if sender_role == "user":
            conv.unread_by_shop += 1
        else:
            conv.unread_by_user += 1

    db.commit()
    db.refresh(msg)
    return _msg_to_out(msg)


def mark_messages_read(db: Session, conversation_id: int, reader_role: str) -> int:
    """
    Đánh dấu đã đọc tất cả tin nhắn gửi cho reader_role.
    Trả về số tin được cập nhật.
    """
    from sqlalchemy.sql import func as sqlfunc
    import datetime

    opposite_role = "shop" if reader_role == "user" else "user"
    updated = (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_id,
            Message.sender_role == opposite_role,
            Message.is_read == False,
        )
        .all()
    )
    now = datetime.datetime.utcnow()
    for m in updated:
        m.is_read = True
        m.read_at = now

    # Reset unread counter
    conv = db.query(Conversation).filter_by(conversation_id=conversation_id).first()
    if conv:
        if reader_role == "user":
            conv.unread_by_user = 0
        else:
            conv.unread_by_shop = 0

    db.commit()
    return len(updated)
