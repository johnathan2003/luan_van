"""
super/backend/routes/flash_sale.py
------------------------------------
Superadmin — ghim tối đa 10 sản phẩm hiển thị ở khu Flash Sale trang chủ.
Dữ liệu ở đây có hiệu lực NGAY trên hệ thống thật (bảng flash_sale_picks
là nguồn duy nhất mà GET /api/v1/products/flash-sale đọc, khi có ít nhất
1 pick). Rỗng thì trang chủ fallback về top bán chạy tự động.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.product import Product, FlashSalePick
from super.middleware import require_super

router = APIRouter()

MAX_PICKS = 10


class PickCreate(BaseModel):
    product_id: int


class PickReorder(BaseModel):
    sort_order: int


def _fmt(pick: FlashSalePick) -> dict:
    p = pick.product
    return {
        "pick_id":     pick.pick_id,
        "sort_order":  pick.sort_order,
        "product_id":  pick.product_id,
        "product_name": p.product_name if p else None,
        "price":        float(p.price) if p else None,
        "image_urls":   p.image_urls if p else None,
        "status":       p.status if p else None,
        "sales_count":  p.sales_count if p else None,
        "shop_id":      p.shop_id if p else None,
    }


@router.get("")
def list_picks(
    _: dict = Depends(require_super),
    db: Session = Depends(get_db),
):
    picks = (
        db.query(FlashSalePick)
        .order_by(FlashSalePick.sort_order.asc(), FlashSalePick.pick_id.asc())
        .all()
    )
    return {"picks": [_fmt(p) for p in picks], "max": MAX_PICKS}


@router.get("/search-products")
def search_products(
    q: str = Query("", min_length=0),
    _: dict = Depends(require_super),
    db: Session = Depends(get_db),
):
    """Tìm sản phẩm active để chọn ghim (loại luôn sản phẩm đã ghim rồi)."""
    already = {r[0] for r in db.query(FlashSalePick.product_id).all()}
    query = db.query(Product).filter(Product.status == "active", Product.deleted_at.is_(None))
    if q:
        query = query.filter(Product.product_name.ilike(f"%{q}%"))
    items = query.order_by(Product.sales_count.desc()).limit(20).all()
    return {
        "products": [
            {
                "product_id":   p.product_id,
                "product_name": p.product_name,
                "price":        float(p.price),
                "image_urls":   p.image_urls,
                "shop_id":      p.shop_id,
                "already_picked": p.product_id in already,
            }
            for p in items
        ]
    }


@router.post("", status_code=201)
def add_pick(
    data: PickCreate,
    _: dict = Depends(require_super),
    db: Session = Depends(get_db),
):
    count = db.query(FlashSalePick).count()
    if count >= MAX_PICKS:
        raise HTTPException(400, f"Đã đủ {MAX_PICKS} sản phẩm Flash Sale — xoá bớt trước khi thêm")

    product = db.query(Product).filter(Product.product_id == data.product_id).first()
    if not product:
        raise HTTPException(404, "Sản phẩm không tồn tại")

    existing = db.query(FlashSalePick).filter(FlashSalePick.product_id == data.product_id).first()
    if existing:
        raise HTTPException(400, "Sản phẩm đã có trong Flash Sale")

    pick = FlashSalePick(product_id=data.product_id, sort_order=count)
    db.add(pick)
    db.commit()
    db.refresh(pick)
    return _fmt(pick)


@router.patch("/{pick_id}")
def update_pick(
    pick_id: int,
    data: PickReorder,
    _: dict = Depends(require_super),
    db: Session = Depends(get_db),
):
    pick = db.query(FlashSalePick).filter(FlashSalePick.pick_id == pick_id).first()
    if not pick:
        raise HTTPException(404, "Không tìm thấy")
    pick.sort_order = data.sort_order
    db.commit()
    return {"message": "Đã cập nhật thứ tự"}


@router.delete("/{pick_id}")
def delete_pick(
    pick_id: int,
    _: dict = Depends(require_super),
    db: Session = Depends(get_db),
):
    pick = db.query(FlashSalePick).filter(FlashSalePick.pick_id == pick_id).first()
    if not pick:
        raise HTTPException(404, "Không tìm thấy")
    db.delete(pick)
    db.commit()
    return {"message": "Đã bỏ ghim"}
