"""
super/backend/routes/products.py
---------------------------------
Superadmin — can thiệp trực tiếp vào bảng products.
Không kiểm tra shop_id, không kiểm tra business rules, không ghi log.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.product import Product
from super.middleware import require_super

router = APIRouter()


class ProductPatch(BaseModel):
    product_name:   Optional[str]   = None
    price:          Optional[float] = None
    stock_quantity: Optional[int]   = None
    description:    Optional[str]   = None
    image_urls:     Optional[list]  = None
    status:         Optional[str]   = None   # active/pending/hidden/rejected
    is_featured:    Optional[bool]  = None


def _product_dict(p: Product) -> dict:
    return {
        "product_id":    p.product_id,
        "product_name":  p.product_name,
        "shop_id":       p.shop_id,
        "price":         str(p.price),
        "stock_quantity": p.stock_quantity,
        "description":   p.description,
        "image_urls":    p.image_urls or [],
        "status":        p.status,
        "is_featured":   getattr(p, "is_featured", False),
        "sales_count":   p.sales_count,
        "created_at":    p.created_at.isoformat() if p.created_at else None,
    }


@router.get("")
def list_products(
    page:   int           = Query(1, ge=1),
    limit:  int           = Query(30, ge=1, le=200),
    status: Optional[str] = None,
    search: Optional[str] = None,
    _:      dict          = Depends(require_super),
    db:     Session       = Depends(get_db),
):
    """Liệt kê tất cả sản phẩm kể cả đã xóa mềm."""
    q = db.query(Product)
    if status and status != "all":
        q = q.filter(Product.status == status)
    if search:
        q = q.filter(Product.product_name.ilike(f"%{search}%"))
    total = q.count()
    items = q.order_by(Product.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"products": [_product_dict(p) for p in items], "total": total, "page": page}


@router.get("/{product_id}")
def get_product(
    product_id: int,
    _:   dict    = Depends(require_super),
    db:  Session = Depends(get_db),
):
    p = db.query(Product).filter(Product.product_id == product_id).first()
    if not p:
        raise HTTPException(404, "Không tìm thấy sản phẩm")
    return _product_dict(p)


@router.patch("/{product_id}")
def patch_product(
    product_id: int,
    data:  ProductPatch,
    _:     dict    = Depends(require_super),
    db:    Session = Depends(get_db),
):
    """Cập nhật bất kỳ field nào của sản phẩm — không ràng buộc business rule."""
    p = db.query(Product).filter(Product.product_id == product_id).first()
    if not p:
        raise HTTPException(404, "Không tìm thấy sản phẩm")

    changes = data.model_dump(exclude_none=True)
    for field, value in changes.items():
        setattr(p, field, value)

    db.commit()
    db.refresh(p)
    return {"message": "Đã cập nhật", "product": _product_dict(p)}


@router.delete("/{product_id}/hard")
def hard_delete_product(
    product_id: int,
    _:   dict    = Depends(require_super),
    db:  Session = Depends(get_db),
):
    """Xóa cứng khỏi DB — không thể phục hồi."""
    p = db.query(Product).filter(Product.product_id == product_id).first()
    if not p:
        raise HTTPException(404, "Không tìm thấy sản phẩm")
    db.delete(p)
    db.commit()
    return {"message": f"Đã xóa cứng product_id={product_id}"}
