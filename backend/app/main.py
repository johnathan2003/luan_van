

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
    wallet, banners, feedback, disputes, slot_auctions, ai_incidents,
)
from app.routes.warehouses import router as warehouses_router
from app.routes.warehouse_accounts import router as warehouse_accounts_router
from app.routes.config_public import router as config_public_router
from app.websocket.connection_manager import sio, init_main_loop

# Superadmin module — nằm ngoài app package, không ghi log
# Docker: super/backend/ được mount tại /app/super/ → import as package 'super'
try:
    from super.router import super_router  # noqa: E402
except Exception:  # noqa: BLE001
    super_router = None
    # logger chưa được khởi tạo ở đây — dùng print để tránh NameError
    print("[WARNING] super module không tìm thấy — /api/super/* endpoints bị tắt")


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


def _ensure_shop_registration_columns():
    """Tự động thêm cột product_images vào bảng shop_registrations nếu chưa có."""
    from sqlalchemy import text
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        exists = db.execute(text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name='shop_registrations' AND column_name='product_images'"
        )).fetchone()
        if not exists:
            db.execute(text("ALTER TABLE shop_registrations ADD COLUMN product_images TEXT"))
            db.commit()
            logger.info("[startup] Added column shop_registrations.product_images")
    except Exception as e:
        db.rollback()
        logger.warning(f"[startup] Could not ensure shop_registrations columns: {e}")
    finally:
        db.close()


def _ensure_variant_attrs_column():
    """Thêm cột attrs_json vào product_variants nếu chưa có."""
    from sqlalchemy import text
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        exists = db.execute(text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name='product_variants' AND column_name='attrs_json'"
        )).fetchone()
        if not exists:
            db.execute(text("ALTER TABLE product_variants ADD COLUMN attrs_json TEXT"))
            db.commit()
            logger.info("[startup] Added column product_variants.attrs_json")
    except Exception as e:
        db.rollback()
        logger.warning(f"[startup] Could not ensure product_variants.attrs_json: {e}")
    finally:
        db.close()


def _ensure_shipper_registration_columns():
    """Thêm các cột mới vào shipper_registrations nếu chưa có."""
    from sqlalchemy import text
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        cols = [
            ("zone_district",    "VARCHAR(100)"),
            ("zone_ward",        "VARCHAR(100)"),
            ("vehicle_photo_url","VARCHAR(500)"),
        ]
        for col, col_type in cols:
            exists = db.execute(text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name='shipper_registrations' AND column_name=:col"
            ), {"col": col}).fetchone()
            if not exists:
                db.execute(text(f"ALTER TABLE shipper_registrations ADD COLUMN {col} {col_type}"))
                db.commit()
                logger.info(f"[startup] Added column shipper_registrations.{col}")
    except Exception as e:
        db.rollback()
        logger.warning(f"[startup] Could not ensure shipper_registration columns: {e}")
    finally:
        db.close()


def _ensure_shop_status_columns():
    """Tự động thêm các cột status/suspended_reason/suspended_at vào bảng shops nếu chưa có."""
    from sqlalchemy import text
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        cols = [
            ("status",           "VARCHAR(20) NOT NULL DEFAULT 'active'"),
            ("suspended_reason", "TEXT"),
            ("suspended_at",     "TIMESTAMP WITHOUT TIME ZONE"),
        ]
        for col, col_type in cols:
            exists = db.execute(text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name='shops' AND column_name=:col"
            ), {"col": col}).fetchone()
            if not exists:
                db.execute(text(f"ALTER TABLE shops ADD COLUMN {col} {col_type}"))
                db.commit()
                logger.info(f"[startup] Added column shops.{col}")
    except Exception as e:
        db.rollback()
        logger.warning(f"[startup] Could not ensure shop status columns: {e}")
    finally:
        db.close()


def _ensure_shop_cover_column():
    """Tự động thêm cột cover_url vào bảng shops nếu chưa có."""
    from sqlalchemy import text
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        exists = db.execute(text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name='shops' AND column_name='cover_url'"
        )).fetchone()
        if not exists:
            db.execute(text("ALTER TABLE shops ADD COLUMN cover_url VARCHAR(500)"))
            db.commit()
            logger.info("[startup] Added column shops.cover_url")
    except Exception as e:
        db.rollback()
        logger.warning(f"[startup] Could not ensure shops.cover_url: {e}")
    finally:
        db.close()


def _ensure_shop_avatar_column():
    """Tự động thêm cột avatar_url vào bảng shops nếu chưa có (safety net)."""
    from sqlalchemy import text
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        exists = db.execute(text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name='shops' AND column_name='avatar_url'"
        )).fetchone()
        if not exists:
            db.execute(text("ALTER TABLE shops ADD COLUMN avatar_url VARCHAR(500)"))
            db.commit()
            logger.info("[startup] Added column shops.avatar_url")
    except Exception as e:
        db.rollback()
        logger.warning(f"[startup] Could not ensure shops.avatar_url: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_main_loop()   # capture asyncio loop sớm nhất — trước mọi request
    logger.info(f"Starting E-Commerce API [{settings.ENVIRONMENT}]...")
    logger.info("Schema managed by Alembic. Skipping create_all().")
    _ensure_shop_registration_columns()
    _ensure_shop_status_columns()
    _ensure_variant_attrs_column()
    _ensure_shipper_registration_columns()
    _ensure_shop_cover_column()
    _ensure_shop_avatar_column()
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
# Kiểm tra Supabase URL hợp lệ (không phải placeholder [project-ref])
_supabase_ready = (
    bool(settings.SUPABASE_URL)
    and "[" not in settings.SUPABASE_URL
    and settings.SUPABASE_URL.startswith("http")
    and bool(settings.SUPABASE_SERVICE_KEY)
)
if not _supabase_ready:
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
app.include_router(feedback.router,      prefix="/api/v1/feedback",       tags=["Feedback"])   # [F-1]
app.include_router(disputes.router,      prefix="/api/v1/disputes",       tags=["Disputes"])   # [F-2]
app.include_router(warehouses_router,                                      tags=["Warehouses"])
app.include_router(warehouse_accounts_router, prefix="/api/v1/warehouse-accounts", tags=["WarehouseAccounts"])
app.include_router(wallet.router,                                          tags=["Wallet"])
app.include_router(banners.router,                                         tags=["Banners"])
app.include_router(slot_auctions.router,                                   tags=["Slot Auctions"])
app.include_router(ai_incidents.router,                                    tags=["AI Guardian"])
app.include_router(config_public_router, prefix="/api/v1",                tags=["Config"])

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
