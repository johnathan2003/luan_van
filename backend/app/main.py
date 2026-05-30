import logging
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import engine, Base
from app.middleware.error_handler import add_exception_handlers
from app.routes import auth, users, products, carts, orders, payments, shipments, shops, admin, notifications
from app.websocket.connection_manager import sio

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting E-Commerce API...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified.")
    yield
    logger.info("Shutting down E-Commerce API...")


app = FastAPI(
    title="E-Commerce API",
    description="4-entity e-commerce platform: User, Shop, Shipper, Admin",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS_LIST,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
add_exception_handlers(app)

# Static files (uploads)
import os
os.makedirs(settings.UPLOAD_FOLDER, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_FOLDER), name="uploads")

# Routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(products.router, prefix="/api/v1/products", tags=["Products"])
app.include_router(carts.router, prefix="/api/v1/carts", tags=["Cart"])
app.include_router(orders.router, prefix="/api/v1/orders", tags=["Orders"])
app.include_router(payments.router, prefix="/api/v1/payments", tags=["Payments"])
app.include_router(shipments.router, prefix="/api/v1/shipments", tags=["Shipments"])
app.include_router(shops.router, prefix="/api/v1/shop", tags=["Shop"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"])

# Socket.io integration
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)


@app.get("/", tags=["Health"])
async def root():
    return {"message": "E-Commerce API v1.0.0", "status": "running"}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy", "environment": settings.ENVIRONMENT}
