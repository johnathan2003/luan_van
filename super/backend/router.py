"""
super/backend/router.py
------------------------
Điểm tập trung tất cả routes superadmin.
Mount vào FastAPI chính tại prefix="/super".
"""
from fastapi import APIRouter
from .auth import router as auth_router
from .routes.products import router as products_router
from .routes.users import router as users_router
from .routes.orders import router as orders_router

super_router = APIRouter(prefix="/api/super", tags=["Superadmin"])

super_router.include_router(auth_router,     prefix="/auth")
super_router.include_router(products_router, prefix="/products")
super_router.include_router(users_router,    prefix="/users")
super_router.include_router(orders_router,   prefix="/orders")
