from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime

from app.models.voucher import Voucher, VoucherCollection
from app.models.shop import Shop


def _creator_roles(voucher: Voucher) -> set:
    if not voucher.creator:
        return set()
    return {ur.role.role_name for ur in voucher.creator.user_roles if ur.status == "active"}


def _to_public(voucher: Voucher, source: str, collected_ids: set, db: Session) -> dict:
    shop_name = None
    if source == "shop":
        shop = db.query(Shop).filter(Shop.shop_id == voucher.created_by).first()
        shop_name = shop.shop_name if shop else None
    return {
        "voucher_id": voucher.voucher_id,
        "code": voucher.code,
        "discount_type": voucher.discount_type,
        "discount_value": str(voucher.discount_value),
        "min_order_value": str(voucher.min_order_value) if voucher.min_order_value else None,
        "max_discount": str(voucher.max_discount) if voucher.max_discount else None,
        "max_uses": voucher.max_uses,
        "current_uses": voucher.current_uses,
        "status": voucher.status,
        "valid_from": voucher.valid_from,
        "valid_to": voucher.valid_to,
        "source": source,
        "shop_name": shop_name,
        "is_collected": voucher.voucher_id in collected_ids,
    }


def _active_vouchers(db: Session):
    now = datetime.utcnow()
    q = db.query(Voucher).filter(Voucher.status == "active")
    return [v for v in q.all() if v.valid_to is None or v.valid_to >= now]


def _collected_ids(db: Session, user_id: int) -> set:
    rows = db.query(VoucherCollection.voucher_id).filter(VoucherCollection.user_id == user_id).all()
    return {r[0] for r in rows}


def list_platform_vouchers(db: Session, user_id: int) -> list:
    collected = _collected_ids(db, user_id)
    result = []
    for v in _active_vouchers(db):
        if "admin" in _creator_roles(v):
            result.append(_to_public(v, "platform", collected, db))
    return result


def list_shop_vouchers(db: Session, user_id: int) -> list:
    collected = _collected_ids(db, user_id)
    result = []
    for v in _active_vouchers(db):
        roles = _creator_roles(v)
        if "shop" in roles and "admin" not in roles:
            result.append(_to_public(v, "shop", collected, db))
    return result


def list_my_collected_vouchers(db: Session, user_id: int) -> list:
    collected = _collected_ids(db, user_id)
    rows = (
        db.query(Voucher)
        .join(VoucherCollection, VoucherCollection.voucher_id == Voucher.voucher_id)
        .filter(VoucherCollection.user_id == user_id)
        .all()
    )
    result = []
    for v in rows:
        roles = _creator_roles(v)
        source = "platform" if "admin" in roles else "shop"
        result.append(_to_public(v, source, collected, db))
    return result


def collect_voucher(db: Session, user_id: int, voucher_id: int) -> VoucherCollection:
    voucher = db.query(Voucher).filter(Voucher.voucher_id == voucher_id).first()
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    if voucher.status != "active":
        raise HTTPException(status_code=400, detail="Voucher không còn hoạt động")
    if voucher.max_uses is not None and voucher.current_uses >= voucher.max_uses:
        raise HTTPException(status_code=400, detail="Voucher đã hết lượt sử dụng")

    existing = (
        db.query(VoucherCollection)
        .filter(VoucherCollection.user_id == user_id, VoucherCollection.voucher_id == voucher_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Bạn đã thu thập voucher này rồi")

    collection = VoucherCollection(user_id=user_id, voucher_id=voucher_id)
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return collection
