"""
super/backend/routes/wallets.py
---------------------------------
Superadmin — bảng ví tiền của TỪNG SHOP.
  - available  = balance - reserved (ShopWallet, ví thật)
  - reserved   = đang giữ cho đấu giá banner (100% ref_type=auction_bid)
  - revenue    = doanh thu từ đơn hàng completed
      + total_revenue = tổng tiền đơn hàng (gross)
      + shop_profit   = phần shop thực nhận sau khi trừ hoa hồng (net,
                         đúng bằng số tiền payout_service.py đã cộng vào
                         ShopWallet.balance)

Đây CHỈ LÀ BẢNG XEM (không CRUD) — số dư ví shop được sinh ra từ business
logic (đơn hàng, đấu giá), sửa tay ở đây sẽ làm sai lệch với các bảng khác.
Muốn chỉnh tay tiền thì dùng bảng "Tài chính hệ thống" (finance.py).
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.wallet_auction import ShopWallet
from app.models.shop import Shop
from app.models.order import Order
from app.models.admin_config import RevenueConfig
from super.middleware import require_super

router = APIRouter()


@router.get("/shops")
def list_shop_wallets(
    q:     Optional[str] = Query(None, description="Tìm theo tên shop"),
    page:  int            = Query(1, ge=1),
    limit: int            = Query(20, ge=1, le=100),
    _:     dict            = Depends(require_super),
    db:    Session         = Depends(get_db),
):
    """Ví + doanh thu từng shop — dùng chung % hoa hồng đang active."""
    cfg = (
        db.query(RevenueConfig)
        .filter(RevenueConfig.is_active == True)
        .order_by(RevenueConfig.config_id.desc())
        .first()
    )
    shop_rate = float(cfg.shop_rate) / 100 if cfg else 0.70

    rev_sub = (
        db.query(
            Order.shop_id.label("shop_id"),
            func.sum(Order.final_price).label("total_revenue"),
            func.count(Order.order_id).label("total_orders"),
        )
        .filter(Order.order_status == "completed")
        .group_by(Order.shop_id)
        .subquery()
    )

    query = (
        db.query(Shop, ShopWallet, rev_sub.c.total_revenue, rev_sub.c.total_orders)
        .outerjoin(ShopWallet, ShopWallet.shop_id == Shop.shop_id)
        .outerjoin(rev_sub, rev_sub.c.shop_id == Shop.shop_id)
    )
    if q:
        query = query.filter(Shop.shop_name.ilike(f"%{q}%"))

    total = query.count()
    rows = (
        query.order_by(Shop.shop_id)
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    items = []
    for shop, wallet, total_revenue, total_orders in rows:
        rev = float(total_revenue or 0)
        balance = float(wallet.balance) if wallet else 0.0
        reserved = float(wallet.reserved) if wallet else 0.0
        items.append({
            "shop_id":       shop.shop_id,
            "shop_name":     shop.shop_name,
            "balance":       balance,
            "reserved":      reserved,
            "available":     balance - reserved,
            "total_orders":  int(total_orders or 0),
            "total_revenue": rev,                          # gross — tổng đơn hàng
            "shop_profit":   round(rev * shop_rate, 2),     # net — thực nhận vào ví
        })

    pages = (total + limit - 1) // limit or 1
    return {"items": items, "total": total, "page": page, "pages": pages, "shop_rate": shop_rate}
