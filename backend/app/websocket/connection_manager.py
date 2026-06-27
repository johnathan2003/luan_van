import asyncio
import logging
import socketio
from typing import Dict, Optional, Set

logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

# Map user_id -> set of socket IDs
user_connections: Dict[int, Set[str]] = {}

# Event loop của main thread — được set trong lifespan startup của FastAPI
_main_loop: Optional[asyncio.AbstractEventLoop] = None


def init_main_loop() -> None:
    """Gọi từ lifespan async context để capture event loop sớm nhất có thể."""
    global _main_loop
    _main_loop = asyncio.get_running_loop()
    logger.info("Socket event loop captured.")


def fire(coro):
    """
    Thread-safe: schedule coroutine từ sync route handler (thread pool).
    Dùng run_coroutine_threadsafe thay vì create_task để tránh race condition.
    """
    global _main_loop
    if _main_loop is None:
        # Fallback: thử lấy loop hiện tại (uvicorn đặt trước khi handle request)
        try:
            _main_loop = asyncio.get_event_loop()
        except RuntimeError:
            logger.warning("fire(): không lấy được event loop, bỏ qua socket event")
            return
    if not _main_loop.is_running():
        logger.warning("fire(): event loop không còn chạy")
        return
    try:
        asyncio.run_coroutine_threadsafe(coro, _main_loop)
    except Exception as e:
        logger.error(f"fire() failed: {e}")


def get_user_sids(user_id: int) -> Set[str]:
    return user_connections.get(user_id, set())


@sio.event
async def connect(sid, environ, auth):
    global _main_loop
    # Lưu event loop khi có connection đầu tiên (chạy trong async context)
    if _main_loop is None:
        _main_loop = asyncio.get_running_loop()

    user_id = None
    if auth:
        user_id = auth.get("user_id")

    if user_id:
        user_id = int(user_id)
        if user_id not in user_connections:
            user_connections[user_id] = set()
        user_connections[user_id].add(sid)
        await sio.save_session(sid, {"user_id": user_id})
        await sio.enter_room(sid, f"user_{user_id}")
        logger.info(f"User {user_id} connected: {sid}")
    else:
        logger.info(f"Anonymous connection: {sid}")


@sio.event
async def disconnect(sid):
    session = await sio.get_session(sid)
    user_id = session.get("user_id") if session else None

    if user_id and user_id in user_connections:
        user_connections[user_id].discard(sid)
        if not user_connections[user_id]:
            del user_connections[user_id]
        logger.info(f"User {user_id} disconnected: {sid}")


@sio.event
async def join_room(sid, data):
    room = data.get("room")
    if room:
        await sio.enter_room(sid, room)
        logger.info(f"Socket {sid} joined room: {room}")


@sio.event
async def leave_room(sid, data):
    room = data.get("room")
    if room:
        await sio.leave_room(sid, room)


# ── Chat events ───────────────────────────────────────────────────────────────

@sio.event
async def join_conversation(sid, data):
    """
    Client gọi khi mở cửa sổ chat.
    data = { conversation_id: int }
    -> Tham gia room "conv_{id}" để nhận new_message realtime.
    """
    conv_id = data.get("conversation_id")
    if conv_id:
        room = f"conv_{conv_id}"
        await sio.enter_room(sid, room)
        logger.info(f"Socket {sid} joined conversation room: {room}")


@sio.event
async def leave_conversation(sid, data):
    """Client gọi khi đóng cửa sổ chat."""
    conv_id = data.get("conversation_id")
    if conv_id:
        await sio.leave_room(sid, f"conv_{conv_id}")


@sio.event
async def typing(sid, data):
    """
    Broadcast trạng thái đang gõ tới phòng hội thoại.
    data = { conversation_id: int, sender_id: int, sender_role: str }
    """
    conv_id = data.get("conversation_id")
    if conv_id:
        session = await sio.get_session(sid)
        await sio.emit(
            "typing",
            {"conversation_id": conv_id, "sender_id": data.get("sender_id"), "sender_role": data.get("sender_role")},
            room=f"conv_{conv_id}",
            skip_sid=sid,
        )


async def send_to_user(user_id: int, event: str, data: dict):
    """Send event to all sessions of a specific user."""
    await sio.emit(event, data, room=f"user_{user_id}")


async def send_to_room(room: str, event: str, data: dict):
    """Send event to all members of a room."""
    await sio.emit(event, data, room=room)


async def broadcast(event: str, data: dict):
    """Broadcast event to all connected clients."""
    await sio.emit(event, data)


def is_user_online(user_id: int) -> bool:
    return user_id in user_connections and len(user_connections[user_id]) > 0
