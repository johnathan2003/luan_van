"""
super/backend/routes/orders.py
--------------------------------
Superadmin — xem và can thiệp trực tiếp bảng orders + order_items.
Không kiểm tra business rules, không ghi log.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from app.database import get_db
from app.models.order import Order, OrderItem
from super.middleware import require_super

router = APIRouter()


class OrderPatch(BaseModel):
    order_status:    Optional[str] = None
    payment_status:  Optional[str] = None
    shipping_address: Optional[str] = None
    notes:           Optional[str] = None


class OrderItemPatch(BaseModel):
    quantity:       Optional[int]   = None
    price_at_order: Optional[float] = None
    product_name:   Optional[str]   = None


def _item_dict(i: OrderItem) -> dict:
    return {
        "order_item_id":  i.order_item_id,
        "product_id":     i.product_id,
        "product_name":   i.product_name,
        "quantity":       i.quantity,
        "price_at_order": str(i.price_at_order),
        "product_image":  i.product_image,
    }


def _order_dict(o: Order, include_items: bool = False) -> dict:
    d = {
        "order_id":        o.order_id,
        "order_number":    o.order_number,
        "user_id":         o.user_id,
        "shop_id":         o.shop_id,
        "total_price":     str(o.total_price),
        "discount_amount": str(o.discount_amount),
        "final_price":     str(o.final_price),
        "shipping_fee":    str(o.shipping_fee),
        "payment_method":  o.payment_method,
        "payment_status":  o.payment_status,
        "order_status":    o.order_status,
        "shipping_address": o.shipping_address,
        "recipient_name":  o.recipient_name,
        "recipient_phone": o.recipient_phone,
        "notes":           o.notes,
        "voucher_code":    o.voucher_code,
        "created_at":      o.created_at.isoformat() if o.created_at else None,
    }
    if include_items and o.items:
        d["items"] = [_item_dict(i) for i in o.items]
    return d


@router.get("")
def list_orders(
    page:         int           = Query(1, ge=1),
    limit:        int           = Query(30, ge=1, le=200),
    order_status: Optional[str] = None,
    user_id:      Optional[int] = None,
    shop_id:      Optional[int] = None,
    _:            dict          = Depends(require_super),
    db:           Session       = Depends(get_db),
):
    q = db.query(Order)
    if order_status and order_status != "all":
        q = q.filter(Order.order_status == order_status)
    if user_id:
        q = q.filter(Order.user_id == user_id)
    if shop_id:
        q = q.filter(Order.shop_id == shop_id)
    total = q.count()
    orders = q.order_by(Order.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"orders": [_order_dict(o) for o in orders], "total": total, "page": page}


@router.get("/{order_id}")
def get_order(
    order_id: int,
    _:   dict    = Depends(require_super),
    db:  Session = Depends(get_db),
):
    """Chi tiết đơn hàng kèm items."""
    o = db.query(Order).options(joinedload(Order.items)).filter(Order.order_id == order_id).first()
    if not o:
        raise HTTPException(404, "Không tìm thấy đơn hàng")
    return _order_dict(o, include_items=True)


@router.patch("/{order_id}")
def patch_order(
    order_id: int,
    data:  OrderPatch,
    _:     dict    = Depends(require_super),
    db:    Session = Depends(get_db),
):
    """Cập nhật status, địa chỉ, ghi chú — trực tiếp DB."""
    o = db.query(Order).filter(Order.order_id == order_id).first()
    if not o:
        raise HTTPException(404, "Không tìm thấy đơn hàng")
    changes = data.model_dump(exclude_none=True)
    for field, value in changes.items():
        setattr(o, field, value)
    db.commit()
    db.refresh(o)
    return {"message": "Đã cập nhật đơn hàng", "order_id": order_id}


@router.patch("/{order_id}/items/{item_id}")
def patch_order_item(
    order_id: int,
    item_id:  int,
    data:  OrderItemPatch,
    _:     dict    = Depends(require_super),
    db:    Session = Depends(get_db),
):
    """Sửa chi tiết dòng đơn hàng — trực tiếp DB."""
    item = db.query(OrderItem).filter(
        OrderItem.order_item_id == item_id,
        OrderItem.order_id == order_id,
    ).first()
    if not item:
        raise HTTPException(404, "Không tìm thấy order item")
    changes = data.model_dump(exclude_none=True)
    for field, value in changes.items():
        setattr(item, field, value)
    db.commit()
    return {"message": "Đã cập nhật order item", "order_item_id": item_id}


@router.delete("/{order_id}/hard")
def hard_delete_order(
    order_id: int,
    _:   dict    = Depends(require_super),
    db:  Session = Depends(get_db),
):
    """Xóa cứng đơn hàng + toàn bộ items — không thể phục hồi."""
    o = db.query(Order).filter(Order.order_id == order_id).first()
    if not o:
        raise HTTPException(404, "Không tìm thấy đơn hàng")
    db.delete(o)
    db.commit()
    return {"message": f"Đã xóa cứng order_id={order_id}"}
