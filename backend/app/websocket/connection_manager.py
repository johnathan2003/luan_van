import logging
import socketio
from typing import Dict, Set

logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

# Map user_id -> set of socket IDs
user_connections: Dict[int, Set[str]] = {}


def get_user_sids(user_id: int) -> Set[str]:
    return user_connections.get(user_id, set())


@sio.event
async def connect(sid, environ, auth):
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
