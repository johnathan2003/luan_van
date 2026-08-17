"""
app/routes/slot_auctions.py
------------------------------
Đấu giá vị trí Flash Sale (flash_slots) và Top sản phẩm (top_slots) — 2 hệ
tách bảng riêng nhưng dùng chung logic ở app/services/slot_auction_service.py.

Phân quyền (đã chốt với người dùng — KHÁC với banner):
  - Admin (require_admin_or_superadmin, hệ thống chính /admin) là người VẬN
    HÀNH: tạo/sửa slot, mở phiên đấu giá, kết thúc sớm, duyệt/từ chối nội
    dung shop nộp, gỡ khoá vi phạm. Y hệt cách banner đang làm cho phần mở
    phiên, NHƯNG ở đây admin còn tự duyệt nội dung luôn (banner thì việc
    duyệt nằm bên super).
  - Super (/super) CHỈ XEM — không có bất kỳ endpoint ghi/sửa nào ở phía
    super cho hệ đấu giá này. Xem super/backend/routes/slot_auctions.py.

Public:
  GET  /api/v1/slots/flash                     — danh sách flash slot đang active
  GET  /api/v1/slots/flash/auctions            — phiên đấu giá flash (mọi status)
  GET  /api/v1/slots/top                        — danh sách top slot đang active
  GET  /api/v1/slots/top/auctions               — phiên đấu giá top (mọi status)

Shop (require_shop_owner):
  POST /api/v1/slots/flash/auctions/{id}/bid
  POST /api/v1/slots/top/auctions/{id}/bid
  GET  /api/v1/slots/my-wins                    — các phiên mình thắng cần thanh toán/nộp nội dung
  POST /api/v1/slots/flash/auctions/{id}/pay-remaining
  POST /api/v1/slots/top/auctions/{id}/pay-remaining
  POST /api/v1/slots/upload-image               — upload ảnh trước khi nộp nội dung
  POST /api/v1/slots/flash/auctions/{id}/submit
  POST /api/v1/slots/top/auctions/{id}/submit

Admin (require_admin_or_superadmin):
  GET  /api/v1/slots/pending-review             — nội dung đang chờ duyệt (cả 2 hệ)
  GET  /api/v1/slots/violations                 — danh sách vi phạm / ban
  POST /api/v1/slots/violations/{shop_id}/unban
  POST /api/v1/slots/flash/{slot_id}... (xem cuối file) — tạo/sửa slot, mở/kết thúc phiên, duyệt nội dung
"""
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import require_shop_owner, require_admin_or_superadmin
from app.models.user import User
from app.models.shop import Shop
from app.models.slot_auctions import (
    FlashSlot, FlashSlotAuction, FlashSlotBid,
    TopSlot, TopSlotAuction, TopSlotBid,
    ShopBidViolation,
)
from app.utils.upload_service import save_upload_file
from app.services import slot_auction_service as svc

router = APIRouter(prefix="/api/v1/slots", tags=["Slot Auctions"])

_FAMILIES = {
    "flash": (FlashSlot, FlashSlotAuction, FlashSlotBid, False),
    "top":   (TopSlot, TopSlotAuction, TopSlotBid, True),
}


def _family(name: str):
    fam = _FAMILIES.get(name)
    if not fam:
        raise HTTPException(404, "Không tồn tại hệ đấu giá này")
    return fam


# ── Formatters ────────────────────────────────────────────────────────────────

def _fmt_slot(s) -> dict:
    return {
        "slot_id":            s.slot_id,
        "name":               s.name,
        "base_price":         float(s.base_price),
        "is_active":          s.is_active,
        "image_width":        s.image_width,
        "image_height":       s.image_height,
        "image_format":       s.image_format,
        "content_rules":      s.content_rules,
        "current_auction_id": s.current_auction_id,
        "preview_image_url":  s.preview_image_url,
    }


def _fmt_auction(a, include_bids=False) -> dict:
    data = {
        "auction_id":       a.auction_id,
        "slot_id":          a.slot_id,
        "slot_name":        a.slot.name if a.slot else None,
        "slot_preview_image_url": a.slot.preview_image_url if a.slot else None,
        "announced_at":     str(a.announced_at) if a.announced_at else None,
        "start_time":       str(a.start_time),
        "end_time":         str(a.end_time),
        "image_width":      a.image_width or (a.slot.image_width if a.slot else None),
        "image_height":     a.image_height or (a.slot.image_height if a.slot else None),
        "image_format":     a.image_format or (a.slot.image_format if a.slot else None),
        "content_rules":    a.content_rules or (a.slot.content_rules if a.slot else None),
        "start_price":      float(a.start_price),
        "current_price":    float(a.current_price),
        "end_price":        float(a.end_price) if a.end_price is not None else None,
        "status":           a.status,
        "winner_shop_id":   a.winner_shop_id,
        "winner_shop":      a.winner_shop.shop_name if a.winner_shop else None,
        "winner_product_id": a.winner_product_id,
        "win_type":         a.win_type,
        "deposit_amount":   float(a.deposit_amount) if a.deposit_amount is not None else None,
        "payment_deadline": str(a.payment_deadline) if a.payment_deadline else None,
        "final_paid_at":    str(a.final_paid_at) if a.final_paid_at else None,
        "submission_image_url": a.submission_image_url,
        "submission_title":     a.submission_title,
        "submission_link":      a.submission_link,
        "submission_status":    a.submission_status,
        "review_deadline":      str(a.review_deadline) if a.review_deadline else None,
        "reject_reason":        a.reject_reason,
        "activates_at":         str(a.activates_at) if a.activates_at else None,
        "submission_attempts":  a.submission_attempts or 0,
    }
    if include_bids:
        data["bids"] = [_fmt_bid(b) for b in sorted(a.bids, key=lambda b: b.created_at, reverse=True)]
    return data


def _fmt_bid(b) -> dict:
    return {
        "bid_id":       b.bid_id,
        "auction_id":   b.auction_id,
        "shop_id":      b.shop_id,
        "shop_name":    b.shop.shop_name if b.shop else None,
        "amount":       float(b.amount),
        "product_id":   b.product_id,
        "product_name": b.product.product_name if b.product else None,
        "created_at":   str(b.created_at),
    }


# ── Public: danh sách slot / phiên ───────────────────────────────────────────

@router.get("/my-wins")
def my_wins(
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    """Các phiên (cả flash + top) mà shop này đang thắng, đang cần thanh
    toán nốt 80%, hoặc đang chờ/ đã bị từ chối nội dung.

    Đăng ký TRƯỚC route GET /{family} — nếu không, "/my-wins" sẽ bị route
    /{family} (family="my-wins") nuốt mất vì cùng dạng 1-segment path."""
    out = []
    for name, (SlotModel, AuctionModel, BidModel, is_top) in _FAMILIES.items():
        svc.sweep_expired_payments(db, AuctionModel)
        svc.sweep_expired_buyout_reviews(db, AuctionModel)
        auctions = (
            db.query(AuctionModel)
            .filter(
                AuctionModel.winner_shop_id == current_user.user_id,
                AuctionModel.status.in_(("ended", "live", "forfeited")),
            )
            .order_by(AuctionModel.created_at.desc())
            .limit(50)
            .all()
        )
        for a in auctions:
            d = _fmt_auction(a)
            d["family"] = name
            out.append(d)
    return {"wins": out}


# ── Admin: duyệt nội dung + vi phạm (đăng ký TRƯỚC /{family} — cùng lý do
# như /my-wins ở trên, tránh bị route /{family} nuốt mất) ────────────────────

@router.get("/pending-review")
def admin_pending_review(
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    """Nội dung shop đã nộp (cả flash + top), đang chờ duyệt trong hạn 6h."""
    out = []
    for name, (SlotModel, AuctionModel, BidModel, is_top) in _FAMILIES.items():
        svc.sweep_expired_buyout_reviews(db, AuctionModel)
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
def admin_list_violations(
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
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


@router.post("/violations/{shop_id}/unban")
def admin_unban_shop(
    shop_id: int,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    v = db.query(ShopBidViolation).filter(ShopBidViolation.shop_id == shop_id).first()
    if not v:
        raise HTTPException(404, "Không tìm thấy vi phạm của shop này")
    v.banned = False
    db.commit()
    return {"message": f"Đã gỡ khoá đấu giá cho shop #{shop_id}"}


@router.get("/{family}")
def list_slots(family: str, db: Session = Depends(get_db)):
    SlotModel, AuctionModel, BidModel, is_top = _family(family)
    svc.activate_due_auctions(db, AuctionModel, is_top=is_top)
    slots = db.query(SlotModel).filter(SlotModel.is_active == True).all()  # noqa: E712
    return {"slots": [_fmt_slot(s) for s in slots]}


@router.get("/{family}/auctions")
def list_auctions(family: str, status: str | None = None, db: Session = Depends(get_db)):
    SlotModel, AuctionModel, BidModel, is_top = _family(family)
    svc.sweep_expired_payments(db, AuctionModel)
    svc.sweep_expired_buyout_reviews(db, AuctionModel)
    svc.activate_due_auctions(db, AuctionModel, is_top=is_top)
    q = db.query(AuctionModel)
    if status:
        q = q.filter(AuctionModel.status == status)
    auctions = q.order_by(AuctionModel.created_at.desc()).limit(100).all()
    return {"auctions": [_fmt_auction(a) for a in auctions]}


@router.get("/{family}/auctions/{auction_id}")
def get_auction(family: str, auction_id: int, db: Session = Depends(get_db)):
    SlotModel, AuctionModel, BidModel, is_top = _family(family)
    svc.sweep_expired_payments(db, AuctionModel)
    svc.sweep_expired_buyout_reviews(db, AuctionModel)
    svc.activate_due_auctions(db, AuctionModel, is_top=is_top)
    a = db.query(AuctionModel).filter(AuctionModel.auction_id == auction_id).first()
    if not a:
        raise HTTPException(404, "Phiên đấu giá không tồn tại")
    return _fmt_auction(a, include_bids=True)


# ── Shop: đặt giá ────────────────────────────────────────────────────────────

@router.post("/{family}/auctions/{auction_id}/bid")
def bid(
    family: str, auction_id: int, body: dict,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    SlotModel, AuctionModel, BidModel, is_top = _family(family)
    svc.sweep_expired_payments(db, AuctionModel)
    svc.sweep_expired_buyout_reviews(db, AuctionModel)
    amount = Decimal(str(body.get("amount", 0)))
    if amount <= 0:
        raise HTTPException(400, "Số tiền không hợp lệ")
    product_id = body.get("product_id")
    if not product_id:
        raise HTTPException(400, "Thiếu product_id — chọn sản phẩm muốn quảng bá trước khi đặt giá")
    result = svc.place_bid(db, AuctionModel, BidModel, auction_id, current_user.user_id, amount, product_id)
    return {"message": "Đặt giá thành công", **result}


@router.get("/{family}/my-bids")
def my_bids(
    family: str,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    SlotModel, AuctionModel, BidModel, is_top = _family(family)
    bids = (
        db.query(BidModel)
        .filter(BidModel.shop_id == current_user.user_id)
        .order_by(BidModel.created_at.desc())
        .limit(50)
        .all()
    )
    return {"bids": [_fmt_bid(b) for b in bids]}


@router.post("/{family}/auctions/{auction_id}/pay-remaining")
def pay_remaining(
    family: str, auction_id: int,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    SlotModel, AuctionModel, BidModel, is_top = _family(family)
    return svc.pay_remaining(db, AuctionModel, auction_id, current_user.user_id)


# ── Shop: nộp nội dung sau khi thắng ─────────────────────────────────────────

@router.post("/upload-image")
async def upload_slot_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    url = await save_upload_file(file, "slot-auctions", db=db, uploaded_by=current_user.user_id)
    return {"url": url}


@router.post("/admin/upload-preview-image")
async def upload_admin_preview_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    """Admin upload ảnh minh hoạ vị trí (khác /upload-image — cái đó dành
    cho shop nộp nội dung sau khi thắng)."""
    url = await save_upload_file(file, "slot-previews", db=db, uploaded_by=current_user.user_id)
    return {"url": url}


@router.post("/{family}/auctions/{auction_id}/submit")
def submit_content(
    family: str, auction_id: int, body: dict,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    SlotModel, AuctionModel, BidModel, is_top = _family(family)
    return svc.submit_content(
        db, AuctionModel, auction_id, current_user.user_id,
        image_url=body.get("image_url"), title=body.get("title"), link=body.get("link"),
    )


# ══════════════════════════════════════════════════════════════════════════
# Admin: vận hành đấu giá (require_admin_or_superadmin) — tạo/sửa slot, mở/
# kết thúc phiên, duyệt/từ chối nội dung. Super KHÔNG có các endpoint này
# (chỉ xem — super/backend/routes/slot_auctions.py chỉ còn GET).
# ══════════════════════════════════════════════════════════════════════════

MIN_ANNOUNCE_LEAD = timedelta(days=1)


@router.post("/{family}")
def admin_create_slot(
    family: str, body: dict,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    SlotModel, AuctionModel, BidModel, is_top = _family(family)
    if not body.get("name"):
        raise HTTPException(400, "Thiếu tên slot")
    slot = SlotModel(
        name=body["name"],
        base_price=Decimal(str(body.get("base_price", 0))),
        image_width=body.get("image_width"),
        image_height=body.get("image_height"),
        image_format=body.get("image_format"),
        content_rules=body.get("content_rules"),
        preview_image_url=body.get("preview_image_url"),
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return _fmt_slot(slot)


@router.put("/{family}/{slot_id}")
def admin_update_slot(
    family: str, slot_id: int, body: dict,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    SlotModel, AuctionModel, BidModel, is_top = _family(family)
    slot = db.query(SlotModel).filter(SlotModel.slot_id == slot_id).first()
    if not slot:
        raise HTTPException(404, "Không tìm thấy slot")
    for field in ("name", "is_active", "image_width", "image_height", "image_format", "content_rules", "preview_image_url"):
        if field in body:
            setattr(slot, field, body[field])
    if "base_price" in body:
        slot.base_price = Decimal(str(body["base_price"]))
    db.commit()
    db.refresh(slot)
    return _fmt_slot(slot)


@router.post("/{family}/auctions")
def admin_create_auction(
    family: str, body: dict,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    """Mở phiên — start_time (bây giờ) phải cách announced_at >= 1 ngày, để
    shop có thời gian chuẩn bị nội dung + tiền. Mở phiên xong tự động báo
    cho toàn bộ shop (notify_shops_of_new_auction)."""
    SlotModel, AuctionModel, BidModel, is_top = _family(family)
    slot_id = body.get("slot_id")
    slot = db.query(SlotModel).filter(SlotModel.slot_id == slot_id).first()
    if not slot:
        raise HTTPException(404, "Không tìm thấy slot")

    start_time = body.get("start_time")
    if not start_time:
        raise HTTPException(400, "Thiếu start_time")
    start_time = datetime.fromisoformat(start_time) if isinstance(start_time, str) else start_time

    now = datetime.now()
    if start_time - now < MIN_ANNOUNCE_LEAD:
        raise HTTPException(400, "Phiên phải được mở trước giờ bắt đầu ít nhất 1 ngày")

    # Top slot KHÔNG có mua đứt — chỉ Flash slot mới cần endPrice.
    end_price = body.get("end_price")
    if not is_top:
        if not end_price or float(end_price) <= 0:
            raise HTTPException(400, "endPrice phải > 0")
    else:
        end_price = None

    start_price = Decimal(str(body.get("start_price") if body.get("start_price") is not None else slot.base_price))
    duration_hours = float(body.get("duration_hours", 24))
    end_time = start_time + timedelta(hours=duration_hours)

    auction = AuctionModel(
        slot_id=slot_id,
        announced_at=now,
        start_time=start_time,
        end_time=end_time,
        start_price=start_price,
        current_price=start_price,
        end_price=Decimal(str(end_price)) if end_price is not None else None,
        status="upcoming",
        display_duration_days=int(body.get("display_duration_days", 2)),
        image_width=body.get("image_width"),
        image_height=body.get("image_height"),
        image_format=body.get("image_format"),
        content_rules=body.get("content_rules"),
    )
    db.add(auction)
    db.flush()
    slot.current_auction_id = auction.auction_id
    db.commit()
    db.refresh(auction)

    notified = svc.notify_shops_of_new_auction(db, auction, slot, family)

    return {**_fmt_auction(auction), "notified_shops": notified}


@router.post("/{family}/auctions/{auction_id}/end")
def admin_end_auction(
    family: str, auction_id: int,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    SlotModel, AuctionModel, BidModel, is_top = _family(family)
    auction = db.query(AuctionModel).filter(AuctionModel.auction_id == auction_id).first()
    if not auction or auction.status not in ("upcoming", "active"):
        raise HTTPException(400, "Phiên không thể kết thúc")
    svc.settle_auction(db, AuctionModel, BidModel, auction_id)
    db.refresh(auction)
    return _fmt_auction(auction)


@router.post("/{family}/auctions/{auction_id}/approve")
def admin_approve_content(
    family: str, auction_id: int,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    SlotModel, AuctionModel, BidModel, is_top = _family(family)
    result = svc.review_content(db, AuctionModel, auction_id, approve=True)
    auction = db.query(AuctionModel).filter(AuctionModel.auction_id == auction_id).first()
    return {**result, **_fmt_auction(auction)}


@router.post("/{family}/auctions/{auction_id}/reject")
def admin_reject_content(
    family: str, auction_id: int, body: dict,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    SlotModel, AuctionModel, BidModel, is_top = _family(family)
    result = svc.review_content(db, AuctionModel, auction_id, approve=False, reject_reason=body.get("reason") or "Không đạt yêu cầu")
    auction = db.query(AuctionModel).filter(AuctionModel.auction_id == auction_id).first()
    return {**result, **_fmt_auction(auction)}
