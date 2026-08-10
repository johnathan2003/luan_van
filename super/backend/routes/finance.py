"""
super/backend/routes/finance.py
----------------------------------
Superadmin — bảng TIỀN CỦA HỆ THỐNG (platform_transactions), tách biệt
hoàn toàn với ví từng shop (wallets.py). Full quyền CRUD — admin có thể
thêm/sửa/xoá trực tiếp từng dòng giao dịch, không ràng buộc business rule
(giống hệt style products.py — "không kiểm tra business rules, không ghi log").

Quy ước dấu: amount dương = tiền VÀO hệ thống (hoa hồng đơn hàng, hoa hồng
đấu giá banner...), amount âm = tiền RA (hoàn tiền, chi trả...).
Số dư hệ thống = SUM(amount) toàn bộ transactions.

Nguồn ghi tự động hiện có (không đi qua đây):
  - payout_service.py  → mỗi đơn hàng completed  (type=commission)
  - banners.py::_settle_auction() → mỗi phiên đấu giá banner kết thúc (type=commission)
Admin có thể thêm thủ công các dòng khác (payout, refund, adjustment...) tại đây.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.admin_config import PlatformTransaction
from super.middleware import require_super

router = APIRouter()

TYPES = ("commission", "refund", "payout", "adjustment")
STATUSES = ("completed", "pending", "cancelled")


class TxnCreate(BaseModel):
    type:      str
    amount:    float
    shop_id:   Optional[int] = None
    shop_name: Optional[str] = None
    order_id:  Optional[int] = None
    status:    str           = "completed"
    note:      Optional[str] = None


class TxnPatch(BaseModel):
    type:      Optional[str]   = None
    amount:    Optional[float] = None
    shop_id:   Optional[int]   = None
    shop_name: Optional[str]   = None
    order_id:  Optional[int]   = None
    status:    Optional[str]   = None
    note:      Optional[str]   = None


def _fmt(t: PlatformTransaction) -> dict:
    return {
        "txn_id":     t.txn_id,
        "type":       t.type,
        "amount":     float(t.amount),
        "shop_id":    t.shop_id,
        "shop_name":  t.shop_name,
        "order_id":   t.order_id,
        "status":     t.status,
        "note":       t.note,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


@router.get("/summary")
def finance_summary(_: dict = Depends(require_super), db: Session = Depends(get_db)):
    """Tổng số dư hệ thống + breakdown theo loại giao dịch."""
    balance = db.query(func.coalesce(func.sum(PlatformTransaction.amount), 0)).scalar()
    by_type_rows = (
        db.query(PlatformTransaction.type, func.sum(PlatformTransaction.amount))
        .group_by(PlatformTransaction.type)
        .all()
    )
    return {
        "balance": float(balance or 0),
        "by_type": {t: float(a or 0) for t, a in by_type_rows},
    }


@router.get("")
def list_transactions(
    page:  int            = Query(1, ge=1),
    limit: int            = Query(20, ge=1, le=100),
    type:  Optional[str]  = Query(None),
    _:     dict            = Depends(require_super),
    db:    Session         = Depends(get_db),
):
    q = db.query(PlatformTransaction)
    if type and type != "all":
        q = q.filter(PlatformTransaction.type == type)
    q = q.order_by(PlatformTransaction.created_at.desc())
    total = q.count()
    rows = q.offset((page - 1) * limit).limit(limit).all()
    pages = (total + limit - 1) // limit or 1
    return {"items": [_fmt(t) for t in rows], "total": total, "page": page, "pages": pages}


@router.post("")
def create_transaction(
    data: TxnCreate,
    _:    dict    = Depends(require_super),
    db:   Session = Depends(get_db),
):
    if data.type not in TYPES:
        raise HTTPException(400, f"type phải thuộc {TYPES}")
    if data.status not in STATUSES:
        raise HTTPException(400, f"status phải thuộc {STATUSES}")
    t = PlatformTransaction(**data.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"message": "Đã tạo", "transaction": _fmt(t)}


@router.patch("/{txn_id}")
def update_transaction(
    txn_id: int,
    data:   TxnPatch,
    _:      dict    = Depends(require_super),
    db:     Session = Depends(get_db),
):
    t = db.query(PlatformTransaction).filter(PlatformTransaction.txn_id == txn_id).first()
    if not t:
        raise HTTPException(404, "Không tìm thấy giao dịch")

    changes = data.model_dump(exclude_none=True)
    if "type" in changes and changes["type"] not in TYPES:
        raise HTTPException(400, f"type phải thuộc {TYPES}")
    if "status" in changes and changes["status"] not in STATUSES:
        raise HTTPException(400, f"status phải thuộc {STATUSES}")
    for field, value in changes.items():
        setattr(t, field, value)

    db.commit()
    db.refresh(t)
    return {"message": "Đã cập nhật", "transaction": _fmt(t)}


@router.delete("/{txn_id}")
def delete_transaction(
    txn_id: int,
    _:      dict    = Depends(require_super),
    db:     Session = Depends(get_db),
):
    t = db.query(PlatformTransaction).filter(PlatformTransaction.txn_id == txn_id).first()
    if not t:
        raise HTTPException(404, "Không tìm thấy giao dịch")
    db.delete(t)
    db.commit()
    return {"message": f"Đã xoá giao dịch #{txn_id}"}
