import logging
import logging.handlers
import os
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.cors import CORSMiddleware as StarletteCORS
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import engine, Base
from app.middleware.error_handler import add_exception_handlers
from app.middleware.logging import RequestLoggingMiddleware
from app.routes import (
    auth, users, products, carts, orders,
    payments, shipments, shops, admin, notifications, vouchers, chat, employee,
)
from app.websocket.connection_manager import sio, init_main_loop

# Superadmin module — nằm ngoài app package, không ghi log
# Docker: super/backend/ được mount tại /app/super/ → import as package 'super'
try:
    from super.router import super_router  # noqa: E402
except ImportError:
    super_router = None
    logger.warning("super module không tìm thấy — /super/* endpoints bị tắt")


def setup_logging():
    """Cấu hình logging: console + file rotating."""
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    handlers: list[logging.Handler] = [logging.StreamHandler()]

    # File handler — chỉ bật nếu LOG_FILE được cấu hình
    if settings.LOG_FILE:
        log_dir = os.path.dirname(settings.LOG_FILE)
        if log_dir:
            os.makedirs(log_dir, exist_ok=True)
        file_handler = logging.handlers.RotatingFileHandler(
            settings.LOG_FILE,
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=5,
            encoding="utf-8",
        )
        file_handler.setFormatter(logging.Formatter(log_format))
        handlers.append(file_handler)

    logging.basicConfig(level=log_level, format=log_format, handlers=handlers)


setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_main_loop()   # capture asyncio loop sớm nhất — trước mọi request
    logger.info(f"Starting E-Commerce API [{settings.ENVIRONMENT}]...")
    # Schema được quản lý hoàn toàn bởi Alembic — KHÔNG dùng create_all()
    # vì models dùng Enum(...) trong khi migration dùng String(50),
    # PostgreSQL yêu cầu ENUM type phải có name → create_all() sẽ fail.
    # Chạy migration trước khi start server: alembic upgrade head
    logger.info("Schema managed by Alembic. Skipping create_all().")
    yield
    logger.info("Shutting down E-Commerce API...")


app = FastAPI(
    title="E-Commerce API",
    description="4-entity e-commerce platform: Buyer, Seller, Shipper, Admin",
    version="1.0.0",
    lifespan=lifespan,
    # Swagger chi hien thi khi DEBUG=True
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# ── Request logging ───────────────────────────────────────────────────────────
app.add_middleware(RequestLoggingMiddleware)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS_LIST,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Exception handlers ────────────────────────────────────────────────────────
add_exception_handlers(app)

# ── Static files: chi mount local khi khong dung Supabase Storage ────────────
if not settings.SUPABASE_URL:
    os.makedirs(settings.UPLOAD_FOLDER, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_FOLDER), name="uploads")
    logger.info("Local file storage enabled (dev mode).")
else:
    logger.info("Supabase Storage enabled (production mode).")

# ── API Routers ───────────────────────────────────────────────────────────────
app.include_router(auth.router,          prefix="/api/v1/auth",          tags=["Auth"])
app.include_router(users.router,         prefix="/api/v1/users",         tags=["Users"])
app.include_router(products.router,      prefix="/api/v1/products",      tags=["Products"])
app.include_router(carts.router,         prefix="/api/v1/carts",         tags=["Cart"])
app.include_router(orders.router,        prefix="/api/v1/orders",        tags=["Orders"])
app.include_router(payments.router,      prefix="/api/v1/payments",      tags=["Payments"])
app.include_router(shipments.router,     prefix="/api/v1/shipments",     tags=["Shipments"])
app.include_router(shops.router,         prefix="/api/v1/shop",          tags=["Shop"])
app.include_router(admin.router,         prefix="/api/v1/admin",         tags=["Admin"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"])
app.include_router(vouchers.router,      prefix="/api/v1/vouchers",      tags=["Vouchers"])
app.include_router(chat.router,          prefix="/api/v1/chat",           tags=["Chat"])
app.include_router(employee.router,      prefix="/api/v1/employee",       tags=["Employee"])

# Superadmin — chỉ mount nếu module tồn tại
if super_router:
    app.include_router(super_router)  # prefix "/super" đã khai báo trong router.py

# ── Socket.io ─────────────────────────────────────────────────────────────────
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

# Bọc CORS ở tầng ngoài cùng (socket_app) để đảm bảo MỌI response đều có header
# — kể cả error từ socket.io layer, không chỉ FastAPI layer
socket_app = StarletteCORS(
    socket_app,
    allow_origins=settings.ALLOWED_ORIGINS_LIST,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health endpoints ──────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    return {"message": "E-Commerce API v1.0.0", "status": "running"}


@app.get("/health", tags=["Health"])
async def health():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "storage": "supabase" if settings.SUPABASE_URL else "local",
        "debug": settings.DEBUG,
    }
