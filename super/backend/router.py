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
from .routes.db_viewer import router as db_viewer_router
from .routes.banners import router as banners_router
from .routes.wallets import router as wallets_router
from .routes.finance import router as finance_router
from .routes.flash_sale import router as flash_sale_router
from .routes.media import router as media_router

super_router = APIRouter(prefix="/api/super", tags=["Superadmin"])

super_router.include_router(auth_router,     prefix="/auth")
super_router.include_router(products_router, prefix="/products")
super_router.include_router(users_router,    prefix="/users")
super_router.include_router(orders_router,   prefix="/orders")
super_router.include_router(db_viewer_router, prefix="/db-viewer")
super_router.include_router(banners_router,  prefix="/banners")
super_router.include_router(wallets_router,  prefix="/wallets")
super_router.include_router(finance_router,  prefix="/finance")
super_router.include_router(flash_sale_router, prefix="/flash-sale")
super_router.include_router(media_router, prefix="/media")
