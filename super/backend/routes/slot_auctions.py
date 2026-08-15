"""
super/backend/routes/slot_auctions.py
----------------------------------------
Superadmin — CHỈ XEM đấu giá slot Flash Sale + Top sản phẩm. Không có bất kỳ
endpoint ghi/sửa nào ở đây — admin (require_admin_or_superadmin, hệ thống
chính) mới là người vận hành: tạo/sửa slot, mở/kết thúc phiên, duyệt/từ
chối nội dung, gỡ khoá vi phạm (xem app/routes/slot_auctions.py, cuối file).

Super đứng ngoài hệ thống, chỉ quan sát toàn bộ dữ liệu để nắm tình hình —
không tham gia vận hành, không có quyền sinh sát ở tính năng này.

Dùng chung format với app.routes.slot_auctions để đảm bảo những gì
superadmin thấy khớp 100% với dữ liệu admin/shop thấy.

Prefix mount tại /api/super/slots (xem router.py).
  GET /{family}             — danh sách slot
  GET /{family}/auctions    — danh sách phiên (mọi trạng thái, kèm bid)
  GET /pending-review       — nội dung đang chờ duyệt (cả 2 hệ, chỉ để xem)
  GET /violations           — danh sách vi phạm / ban (chỉ để xem)
"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.slot_auctions import (
    FlashSlot, FlashSlotAuction, FlashSlotBid,
    TopSlot, TopSlotAuction, TopSlotBid,
    ShopBidViolation,
)
from app.models.shop import Shop
from app.routes.slot_auctions import _fmt_slot, _fmt_auction
from app.services import slot_auction_service as svc
from super.middleware import require_super

router = APIRouter()

_FAMILIES = {
    "flash": (FlashSlot, FlashSlotAuction, FlashSlotBid, False),
    "top":   (TopSlot, TopSlotAuction, TopSlotBid, True),
}


def _family(name: str):
    from fastapi import HTTPException
    fam = _FAMILIES.get(name)
    if not fam:
        raise HTTPException(404, "Không tồn tại hệ đấu giá này")
    return fam


# ── Đăng ký TRƯỚC route GET /{family} — nếu không, "/pending-review" và
# "/violations" sẽ bị route /{family} (family="pending-review"/"violations")
# nuốt mất vì cùng dạng 1-segment path. ───────────────────────────────────────

@router.get("/pending-review")
def pending_review(_: dict = Depends(require_super), db: Session = Depends(get_db)):
    """Nội dung shop đã nộp (cả flash + top), đang chờ admin duyệt — super
    chỉ xem để nắm tình hình, KHÔNG duyệt được ở đây."""
    out = []
    for name, (SlotModel, AuctionModel, BidModel, is_top) in _FAMILIES.items():
        auctions = (
            db.query(AuctionModel)
            .filter(AuctionModel.submission_status == "pending")
            .order_by(AuctionModel.submitted_at.desc())
            .all()
        )
        for a in auctions:
            d = _fmt_auction(a)
            d["family"] = name
            out.append(d)
    return {"pending": out}


@router.get("/violations")
def list_violations(_: dict = Depends(require_super), db: Session = Depends(get_db)):
    """Danh sách vi phạm/ban — super chỉ xem, KHÔNG gỡ khoá được ở đây."""
    rows = db.query(ShopBidViolation).order_by(ShopBidViolation.violation_count.desc()).all()
    out = []
    for v in rows:
        shop = db.query(Shop).filter(Shop.shop_id == v.shop_id).first()
        out.append({
            "shop_id":         v.shop_id,
            "shop_name":       shop.shop_name if shop else None,
            "violation_count": v.violation_count,
            "banned":          v.banned,
            "updated_at":      str(v.updated_at) if v.updated_at else None,
        })
    return {"violations": out}


@router.get("/{family}")
def list_slots(family: str, _: dict = Depends(require_super), db: Session = Depends(get_db)):
    SlotModel, AuctionModel, BidModel, is_top = _family(family)
    slots = db.query(SlotModel).order_by(SlotModel.slot_id).all()
    return {"slots": [_fmt_slot(s) for s in slots]}


@router.get("/{family}/auctions")
def list_auctions(family: str, status: Optional[str] = None, _: dict = Depends(require_super), db: Session = Depends(get_db)):
    SlotModel, AuctionModel, BidModel, is_top = _family(family)
    # Lazy-check vẫn chạy để số liệu super xem luôn đúng thực tế hiện tại,
    # dù bản thân super không kích hoạt hành động gì.
    svc.sweep_expired_payments(db, AuctionModel)
    svc.activate_due_auctions(db, AuctionModel, is_top=is_top)
    q = db.query(AuctionModel)
    if status:
        q = q.filter(AuctionModel.status == status)
    auctions = q.order_by(AuctionModel.created_at.desc()).limit(200).all()
    return {"auctions": [_fmt_auction(a, include_bids=True) for a in auctions]}
