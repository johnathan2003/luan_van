"""
app/routes/banners.py
----------------------
Banner slot + auction + real-time bidding.

Luồng tiền/nội dung (đã chốt với người dùng — xem docstring BannerAuction
trong app/models/wallet_auction.py để biết chi tiết đầy đủ):
  - Vẫn giữ cơ chế RESERVE tiền lúc bid (khác slot_auctions — slot không
    reserve). Thắng thường (win_type='bid') -> trừ THẬT 20% ngay, 80% còn
    lại VẪN nằm reserved chờ 30 phút trả nốt. Trễ hạn -> KHÔNG thả tiền,
    trừ luôn (mất trắng) + ghi vi phạm (CHUNG bảng với slot_auctions). Người
    thua cuộc không bị ảnh hưởng gì.
  - Mọi phiên banner BẮT BUỘC có endPrice — chạm/vượt = mua đứt, trừ THẬT
    100% ngay lập tức (tại chính lúc bid, không đợi hết giờ). Khoá mua đứt
    trong 6 tiếng cuối trước end_time (giống slot).
  - Nội dung: win_type='buyout' tối đa 10 lần nộp trong hạn 6h tính từ lúc
    trả tiền (khác slot chỉ 3 lần). win_type='bid' không giới hạn số lần
    nộp, hạn 6h tính từ lần nộp đầu tiên.
  - Duyệt nội dung do ADMIN làm (đã chuyển từ super sang, đồng bộ với
    slot_auctions — super chỉ còn xem). Duyệt xong KHÔNG lên ngay — chờ
    0:00 hôm sau (activates_at) mới promote vào bảng "banners" chính thức,
    giống hệt cách slot hoạt động.

Public:
  GET  /api/v1/banners/slots                   — danh sách slot đang active
  GET  /api/v1/banners/auctions                — danh sách phiên đấu giá

Shop (require shop role):
  POST /api/v1/banners/auctions/{id}/bid            — đặt giá (Redis rate-limit 1 bid/3s)
  POST /api/v1/banners/auctions/{id}/pay-remaining   — trả nốt 80% (win_type='bid')
  POST /api/v1/banners/auctions/{id}/submit          — nộp ảnh banner sau khi thắng
  GET  /api/v1/banners/my-bids                       — lịch sử bid của shop

Admin (require_admin_or_superadmin):
  POST /api/v1/banners/slots                   — tạo slot
  PUT  /api/v1/banners/slots/{id}              — sửa slot
  POST /api/v1/banners/auctions                — mở phiên đấu giá (bắt buộc endPrice)
  POST /api/v1/banners/auctions/{id}/end       — kết thúc phiên sớm
  GET  /api/v1/banners/admin/auctions          — tất cả phiên (kể cả ended)
  GET  /api/v1/banners/admin/pending-review    — nội dung chờ duyệt
  POST /api/v1/banners/auctions/{id}/approve   — duyệt nội dung
  POST /api/v1/banners/auctions/{id}/reject    — từ chối nội dung
"""
import json
from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user, require_shop_owner, require_admin_or_superadmin
from app.models.user import User
from app.models.wallet_auction import (
    BannerSlot, BannerAuction, BannerBid, Banner, ShopWallet, ShopWalletTransaction,
)
from app.models.shop import Shop
from app.models.admin_config import PlatformTransaction
from app.utils.helpers import paginate
from app.utils.upload_service import save_upload_file
from app.websocket.connection_manager import sio, fire
from app.services.slot_auction_service import (
    DEPOSIT_RATE, PAYMENT_WINDOW_MINUTES, REVIEW_WINDOW_HOURS, BUYOUT_LOCK_BEFORE_END,
    MAX_VIOLATIONS, is_shop_banned, _get_or_create_violation, _next_midnight,
)

router = APIRouter(prefix="/api/v1/banners", tags=["Banners"])

MAX_BANNER_BUYOUT_SUBMISSIONS = 10   # khác slot (chỉ 3) — theo yêu cầu người dùng

# ── Redis (optional — graceful fallback nếu chưa có Redis) ───────────────────
try:
    import redis as _redis
    _r: _redis.Redis | None = None
    def _get_redis() -> _redis.Redis | None:
        global _r
        if _r is None:
            import os
            try:
                _r = _redis.Redis(
                    host=os.getenv("REDIS_HOST", "localhost"),
                    port=int(os.getenv("REDIS_PORT", 6379)),
                    password=os.getenv("REDIS_PASSWORD") or None,
                    decode_responses=True,
                )
                _r.ping()
            except Exception:
                _r = None
        return _r
except ImportError:
    def _get_redis():  # type: ignore
        return None

_BID_COOLDOWN = 3   # giây
_BID_ROOM = "banner_auction"


# ── Formatters ────────────────────────────────────────────────────────────────

def _fmt_slot(s: BannerSlot) -> dict:
    return {
        "slot_id":            s.slot_id,
        "name":               s.name,
        "position":           s.position,
        "width":              s.width,
        "height":             s.height,
        "base_price":         float(s.base_price),
        "duration_days":      s.duration_days,
        "is_active":          s.is_active,
        "current_auction_id": s.current_auction_id,
        "preview_image_url":  s.preview_image_url,
    }


def _fmt_auction(a: BannerAuction, include_bids=False) -> dict:
    data = {
        "auction_id":     a.auction_id,
        "slot_id":        a.slot_id,
        "slot_name":      a.slot.name if a.slot else None,
        "slot_position":  a.slot.position if a.slot else None,
        "slot_preview_image_url": a.slot.preview_image_url if a.slot else None,
        "start_time":     str(a.start_time),
        "end_time":       str(a.end_time),
        "status":         a.status,
        "start_price":    float(a.start_price),
        "current_price":  float(a.current_price),
        "end_price":      float(a.end_price) if a.end_price is not None else None,
        "winner_shop_id": a.winner_shop_id,
        "winner_shop":    a.winner_shop.shop_name if a.winner_shop else None,
        "win_type":       a.win_type,
        "bid_count":      len(a.bids) if include_bids else None,
        "deposit_amount":   float(a.deposit_amount) if a.deposit_amount is not None else None,
        "payment_deadline": str(a.payment_deadline) if a.payment_deadline else None,
        "final_paid_at":    str(a.final_paid_at) if a.final_paid_at else None,
        # Nội dung banner nộp sau khi thắng — xem POST /auctions/{id}/submit
        "banner_image_url":     a.banner_image_url,
        "banner_title":         a.banner_title,
        "banner_link":          a.banner_link,
        "banner_status":        a.banner_status,
        "banner_reject_reason": a.banner_reject_reason,
        "submission_attempts":  a.submission_attempts or 0,
        "review_deadline":      str(a.review_deadline) if a.review_deadline else None,
        "activates_at":         str(a.activates_at) if a.activates_at else None,
    }
    if include_bids:
        data["bids"] = [_fmt_bid(b) for b in sorted(a.bids, key=lambda b: b.created_at, reverse=True)]
    return data


def get_live_banners(db: Session, position: str | None = None) -> list[dict]:
    """Danh sách banner ĐANG THẬT SỰ hiển thị trên site — nguồn sự thật DUY
    NHẤT dùng chung bởi:
      - GET /api/v1/banners/live (public — Home.tsx trang chủ gọi)
      - GET /api/super/banners/live (superadmin xem — PHẢI khớp 100% với
        trang chủ, không có bản sao/logic riêng nào khác)

    Đọc TRỰC TIẾP từ bảng "banners" (banner CHÍNH THỨC, status='active') —
    KHÔNG còn đọc thẳng banner_auctions nữa. Khi superadmin duyệt 1 banner
    shop nộp, hoặc tự thêm/sửa/xoá banner thủ công trong bảng này, trang chủ
    thấy thay đổi NGAY — đúng quy tắc "dữ liệu trong super luôn có hiệu lực
    trong hệ thống". Mỗi slot chỉ lấy đúng 1 banner (mới nhất theo updated_at).
    """
    query = (
        db.query(Banner)
        .join(BannerSlot, Banner.slot_id == BannerSlot.slot_id)
        .filter(
            Banner.status == "active",
            BannerSlot.is_active == True,
        )
    )
    if position:
        query = query.filter(BannerSlot.position == position)
    rows = query.order_by(Banner.updated_at.desc()).all()

    seen_slots: set[int] = set()
    result = []
    for b in rows:
        if b.slot_id in seen_slots:
            continue  # đã có banner mới hơn cho slot này rồi
        seen_slots.add(b.slot_id)
        result.append({
            "banner_id":  b.banner_id,
            "position":   b.slot.position if b.slot else b.position,
            "slot_id":    b.slot_id,
            "slot_name":  b.slot.name if b.slot else None,
            "auction_id": b.source_auction_id,
            "image_url":  b.image_url,
            "title":      b.title,
            "link":       b.link,
            "shop_name":  b.shop_name,
            "reviewed_at": str(b.updated_at) if b.updated_at else None,
        })
    return result


def _fmt_bid(b: BannerBid) -> dict:
    shop = b.shop
    return {
        "bid_id":     b.bid_id,
        "auction_id": b.auction_id,
        "shop_id":    b.shop_id,
        "shop_name":  shop.shop_name if shop else str(b.shop_id),
        "amount":     float(b.amount),
        "status":     b.status,
        "created_at": str(b.created_at),
    }


# ── Public: slots & auctions ─────────────────────────────────────────────────

@router.get("/slots")
def list_slots(db: Session = Depends(get_db)):
    slots = db.query(BannerSlot).filter(BannerSlot.is_active == True).order_by(BannerSlot.slot_id).all()
    return {"slots": [_fmt_slot(s) for s in slots]}


@router.get("/auctions")
def list_auctions(
    status: str = Query("active", regex="^(active|upcoming|ended|all)$"),
    db: Session = Depends(get_db),
):
    _refresh_auction_statuses(db)
    query = db.query(BannerAuction)
    if status != "all":
        query = query.filter(BannerAuction.status == status)
    auctions = query.order_by(BannerAuction.end_time.asc()).all()
    return {"auctions": [_fmt_auction(a, include_bids=True) for a in auctions]}


@router.get("/auctions/{auction_id}")
def get_auction(auction_id: int, db: Session = Depends(get_db)):
    _refresh_auction_statuses(db)
    a = db.query(BannerAuction).filter(BannerAuction.auction_id == auction_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Auction not found")
    return _fmt_auction(a, include_bids=True)


@router.get("/live")
def live_banners(position: str | None = None, db: Session = Depends(get_db)):
    """Banner ĐANG THẬT SỰ hiển thị trên site — Home.tsx gọi endpoint này cho
    cả 4 vị trí (home_slider/mall_ads_main/mall_ads_fixed/mall_banner). Cùng
    dữ liệu hệt như superadmin thấy ở GET /api/super/banners/live."""
    _refresh_auction_statuses(db)
    return {"banners": get_live_banners(db, position)}


# ── Shop: đặt giá ────────────────────────────────────────────────────────────

@router.post("/auctions/{auction_id}/bid")
def place_bid(
    auction_id: int,
    body: dict,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    """
    Đặt giá trong phiên đấu giá.
    - Redis sliding window: 1 bid/3s per shop
    - Atomic: reserve tiền trong ví khi bid thắng
    - Release: trả tiền cho shop bị vượt giá
    - Chạm/vượt end_price (và không trong 6h khoá cuối phiên) -> mua đứt,
      trừ thật toàn bộ reserve NGAY, kết phiên tại chỗ.
    """
    _refresh_auction_statuses(db)
    auction = db.query(BannerAuction).filter(BannerAuction.auction_id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction.status != "active":
        raise HTTPException(status_code=400, detail=f"Phiên đấu giá không active (status: {auction.status})")

    shop_id = current_user.user_id
    if is_shop_banned(db, shop_id):
        raise HTTPException(status_code=403, detail="Tài khoản bị khoá đấu giá do vi phạm thanh toán quá 3 lần")

    amount = Decimal(str(body.get("amount", 0)))
    min_bid = Decimal(str(auction.current_price)) + Decimal("1000")
    if amount < min_bid:
        raise HTTPException(
            status_code=400,
            detail=f"Giá tối thiểu là {float(min_bid):,.0f}đ (giá hiện tại + 1,000đ)"
        )

    # ── Rate limiting via Redis ──────────────────────────────────────────────
    rc = _get_redis()
    if rc:
        rate_key = f"bid_rate:{auction_id}:{shop_id}"
        if rc.exists(rate_key):
            ttl = rc.ttl(rate_key)
            raise HTTPException(
                status_code=429,
                detail=f"Đặt giá quá nhanh — chờ {ttl}s trước khi đặt lại"
            )
        rc.set(rate_key, "1", ex=_BID_COOLDOWN)

    # ── Kiểm tra số dư ví ────────────────────────────────────────────────────
    wallet = db.query(ShopWallet).filter(ShopWallet.shop_id == shop_id).first()
    if not wallet:
        raise HTTPException(status_code=400, detail="Shop chưa có ví — hãy nạp tiền trước")

    available = Decimal(str(wallet.balance)) - Decimal(str(wallet.reserved))
    if amount > available:
        raise HTTPException(
            status_code=400,
            detail=f"Số dư khả dụng không đủ ({float(available):,.0f}đ < {float(amount):,.0f}đ)"
        )

    # ── Release tiền cho người bid trước (nếu có) ────────────────────────────
    if auction.winner_bid_id:
        prev_bid = db.query(BannerBid).filter(BannerBid.bid_id == auction.winner_bid_id).first()
        if prev_bid and prev_bid.shop_id != shop_id:
            prev_wallet = db.query(ShopWallet).filter(ShopWallet.shop_id == prev_bid.shop_id).first()
            if prev_wallet:
                prev_wallet.reserved = Decimal(str(prev_wallet.reserved)) - Decimal(str(prev_bid.amount))
                db.add(ShopWalletTransaction(
                    wallet_id=prev_wallet.wallet_id, shop_id=prev_bid.shop_id,
                    amount=prev_bid.amount, txn_type="release",
                    ref_type="auction_outbid", ref_id=auction_id,
                    note=f"Hoàn giữ tiền — bị vượt giá tại phiên #{auction_id}",
                ))
            prev_bid.status = "outbid"

    # ── Reserve tiền cho bid mới ──────────────────────────────────────────────
    wallet.reserved = Decimal(str(wallet.reserved)) + amount

    db.add(ShopWalletTransaction(
        wallet_id=wallet.wallet_id, shop_id=shop_id,
        amount=-amount, txn_type="reserve",
        ref_type="auction_bid", ref_id=auction_id,
        note=f"Giữ tiền đấu giá banner slot #{auction.slot_id}",
    ))

    # ── Tạo bid record ────────────────────────────────────────────────────────
    bid = BannerBid(
        auction_id=auction_id, shop_id=shop_id,
        amount=amount, status="active",
    )
    db.add(bid)
    db.flush()   # để có bid.bid_id

    # ── Cập nhật auction ──────────────────────────────────────────────────────
    auction.current_price  = amount
    auction.winner_shop_id = shop_id
    auction.winner_bid_id  = bid.bid_id

    # ── Mua đứt: chạm/vượt endPrice và KHÔNG trong 6h khoá cuối phiên ────────
    now = datetime.now()
    end_price = Decimal(str(auction.end_price)) if auction.end_price is not None else None
    buyout_locked = (auction.end_time - now) < BUYOUT_LOCK_BEFORE_END
    is_buyout = bool(end_price is not None and amount >= end_price and not buyout_locked)

    if is_buyout:
        _settle_buyout(db, auction, bid, wallet)
        db.commit()
        db.refresh(bid)
        fire(sio.emit("banner:auction_ended", {
            "auction_id": auction_id, "winner_shop_id": shop_id,
            "final_price": float(amount), "win_type": "buyout",
        }, room=_BID_ROOM))
        return {
            "message": "🎉 Bạn đã MUA ĐỨT vị trí banner này!",
            "bid_id": bid.bid_id, "amount": float(amount),
            "auction_id": auction_id, "buyout": True,
        }

    db.commit()
    db.refresh(bid)

    # ── Broadcast real-time ──────────────────────────────────────────────────
    shop = db.query(Shop).filter(Shop.shop_id == shop_id).first()
    payload = {
        "event":       "bid_placed",
        "auction_id":  auction_id,
        "slot_id":     auction.slot_id,
        "bid_id":      bid.bid_id,
        "shop_id":     shop_id,
        "shop_name":   shop.shop_name if shop else str(shop_id),
        "amount":      float(amount),
        "current_price": float(amount),
        "timestamp":   str(bid.created_at),
    }
    fire(sio.emit("banner:bid_update", payload, room=_BID_ROOM))

    return {
        "message": "Đặt giá thành công",
        "bid_id":  bid.bid_id,
        "amount":  float(amount),
        "auction_id": auction_id,
        "buyout": False,
        "buyout_locked": bool(end_price is not None and amount >= end_price and buyout_locked),
        "wallet_available": float(available) - float(amount),
    }


@router.post("/auctions/{auction_id}/pay-remaining")
def pay_remaining(
    auction_id: int,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    """Winner trả nốt 80% còn lại (chỉ áp dụng win_type='bid' — buyout đã
    trả đủ 100% ngay lúc mua đứt). Số tiền này vốn đã nằm trong "reserved"
    từ lúc bid — ở đây chỉ chuyển nó từ reserved sang thu thật."""
    _refresh_auction_statuses(db)
    auction = db.query(BannerAuction).filter(BannerAuction.auction_id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction.winner_shop_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Bạn không phải người thắng phiên này")
    if auction.win_type != "bid" or auction.final_paid_at:
        raise HTTPException(status_code=400, detail="Phiên này không cần thanh toán thêm")

    now = datetime.now()
    if auction.payment_deadline and now > auction.payment_deadline:
        _forfeit_banner_payment(db, auction)
        db.commit()
        raise HTTPException(status_code=400, detail="Đã quá hạn thanh toán 30 phút — vị trí đã bị huỷ")

    remaining = Decimal(str(auction.current_price)) - Decimal(str(auction.deposit_amount or 0))
    wallet = db.query(ShopWallet).filter(ShopWallet.shop_id == current_user.user_id).first()
    if not wallet:
        raise HTTPException(status_code=400, detail="Shop chưa có ví")

    wallet.balance  = Decimal(str(wallet.balance))  - remaining
    wallet.reserved = Decimal(str(wallet.reserved)) - remaining
    db.add(ShopWalletTransaction(
        wallet_id=wallet.wallet_id, shop_id=current_user.user_id,
        amount=-remaining, txn_type="charge",
        ref_type="banner_final", ref_id=auction_id,
        note=f"Thanh toán nốt 80% banner — phiên #{auction_id}",
    ))
    shop_obj = db.query(Shop).filter(Shop.shop_id == current_user.user_id).first()
    db.add(PlatformTransaction(
        type="commission", amount=remaining, shop_id=current_user.user_id,
        shop_name=shop_obj.shop_name if shop_obj else None, status="completed",
        note=f"Doanh thu nốt 80% banner slot #{auction.slot_id} (phiên #{auction_id})",
    ))
    auction.final_paid_at = now
    db.commit()
    return {"message": "Đã thanh toán đủ", "final_paid_at": now.isoformat()}


@router.get("/my-bids")
def my_bids(
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    bids = (
        db.query(BannerBid)
        .filter(BannerBid.shop_id == current_user.user_id)
        .order_by(BannerBid.created_at.desc())
        .limit(50)
        .all()
    )
    return {"bids": [_fmt_bid(b) for b in bids]}


@router.post("/upload-image")
async def upload_banner_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    """Shop upload ảnh banner (dùng trước khi gọi /auctions/{id}/submit) —
    tái dùng save_upload_file() y hệt cách /products/upload-image làm, chỉ
    khác subfolder để tách riêng thư mục ảnh banner."""
    url = await save_upload_file(file, "banners", db=db, uploaded_by=current_user.user_id)
    return {"url": url}


@router.post("/auctions/{auction_id}/submit")
def submit_banner(
    auction_id: int,
    body: dict,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    """Shop nộp ảnh banner sau khi thắng đấu giá — bắt buộc auction đã kết
    thúc (status='ended'), đúng là shop đã thắng, và đã trả đủ tiền
    (final_paid_at). Nộp xong chuyển sang banner_status='pending', chờ
    ADMIN duyệt (POST /auctions/{id}/approve — đã chuyển từ super sang) mới
    thật sự lên site.

    win_type='buyout': tối đa MAX_BANNER_BUYOUT_SUBMISSIONS (10) lần nộp
    trong hạn 6h tính từ lúc trả tiền (review_deadline đã set lúc mua đứt).
    win_type='bid': không giới hạn số lần nộp, hạn 6h tính từ LẦN NỘP ĐẦU
    TIÊN (review_deadline set ở đây nếu chưa có)."""
    _refresh_auction_statuses(db)
    auction = db.query(BannerAuction).filter(BannerAuction.auction_id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction.status != "ended":
        raise HTTPException(status_code=400, detail="Phiên đấu giá chưa kết thúc")
    if auction.winner_shop_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Bạn không phải người thắng phiên đấu giá này")
    if not auction.final_paid_at:
        raise HTTPException(status_code=400, detail="Cần thanh toán đủ trước khi nộp nội dung")
    if auction.banner_status == "approved":
        raise HTTPException(status_code=400, detail="Banner đã được duyệt, không thể nộp lại")

    image_url = (body.get("image_url") or "").strip()
    if not image_url:
        raise HTTPException(status_code=400, detail="Thiếu ảnh banner")

    now = datetime.now()
    if auction.win_type == "buyout":
        if auction.review_deadline and now > auction.review_deadline:
            _forfeit_banner_review(db, auction)
            db.commit()
            raise HTTPException(status_code=400, detail="Đã quá hạn 6 tiếng để nộp/duyệt nội dung — vị trí đã bị huỷ")
        if (auction.submission_attempts or 0) >= MAX_BANNER_BUYOUT_SUBMISSIONS:
            raise HTTPException(status_code=400, detail=f"Đã hết {MAX_BANNER_BUYOUT_SUBMISSIONS} lần nộp nội dung cho phép")

    auction.banner_image_url  = image_url
    auction.banner_title      = (body.get("title") or "").strip() or None
    auction.banner_link       = (body.get("link") or "").strip() or None
    auction.banner_status     = "pending"
    auction.banner_submitted_at = now
    auction.banner_reviewed_at  = None
    auction.banner_reject_reason = None
    auction.submission_attempts = (auction.submission_attempts or 0) + 1
    if not auction.review_deadline:
        # Chỉ áp dụng cho win_type='bid' — buyout đã set review_deadline
        # ngay lúc _settle_buyout (tính từ lúc trả tiền).
        auction.review_deadline = now + timedelta(hours=REVIEW_WINDOW_HOURS)
    db.commit()

    remaining = None
    if auction.win_type == "buyout":
        remaining = MAX_BANNER_BUYOUT_SUBMISSIONS - auction.submission_attempts
    return {"message": "Đã nộp banner, đang chờ admin duyệt", "attempts_remaining": remaining, **_fmt_auction(auction)}


# ── Admin: quản lý slots & auctions ─────────────────────────────────────────

@router.post("/slots")
def create_slot(
    body: dict,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    slot = BannerSlot(
        name=body["name"],
        position=body.get("position", "top"),
        width=body.get("width"),
        height=body.get("height"),
        base_price=Decimal(str(body.get("base_price", 0))),
        duration_days=int(body.get("duration_days", 7)),
        preview_image_url=body.get("preview_image_url"),
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return _fmt_slot(slot)


@router.put("/slots/{slot_id}")
def update_slot(
    slot_id: int,
    body: dict,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    slot = db.query(BannerSlot).filter(BannerSlot.slot_id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    for field in ("name", "position", "width", "height", "duration_days", "is_active", "preview_image_url"):
        if field in body:
            setattr(slot, field, body[field])
    if "base_price" in body:
        slot.base_price = Decimal(str(body["base_price"]))
    db.commit()
    return _fmt_slot(slot)


@router.post("/admin/upload-preview-image")
async def upload_slot_preview_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    """Admin upload ảnh minh hoạ vị trí (khác /upload-image — cái đó dành
    cho shop nộp nội dung banner sau khi thắng)."""
    url = await save_upload_file(file, "slot-previews", db=db, uploaded_by=current_user.user_id)
    return {"url": url}


@router.post("/auctions")
def create_auction(
    body: dict,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    """
    Mở phiên đấu giá cho 1 slot.
    duration_hours: thời gian phiên (mặc định 24h).
    end_price: BẮT BUỘC — giá mua đứt (mọi phiên banner đều phải có).
    """
    slot_id = body.get("slot_id")
    slot = db.query(BannerSlot).filter(BannerSlot.slot_id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    end_price = body.get("end_price")
    if not end_price or float(end_price) <= 0:
        raise HTTPException(status_code=400, detail="endPrice phải > 0 — mọi phiên banner đều bắt buộc có mua đứt")

    duration_h = int(body.get("duration_hours", 24))
    start = datetime.now()
    end   = start + timedelta(hours=duration_h)

    auction = BannerAuction(
        slot_id=slot_id,
        start_time=start,
        end_time=end,
        status="active",
        start_price=Decimal(str(body.get("start_price", float(slot.base_price)))),
        current_price=Decimal(str(body.get("start_price", float(slot.base_price)))),
        end_price=Decimal(str(end_price)),
    )
    db.add(auction)
    db.flush()

    # Gắn vào slot
    slot.current_auction_id = auction.auction_id
    db.commit()
    db.refresh(auction)

    fire(sio.emit("banner:auction_opened", {
        "auction_id": auction.auction_id,
        "slot_id":    slot_id,
        "slot_name":  slot.name,
        "end_time":   str(end),
        "start_price": float(auction.start_price),
    }, room=_BID_ROOM))

    return _fmt_auction(auction)


@router.post("/auctions/{auction_id}/end")
def end_auction(
    auction_id: int,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    """
    Kết thúc phiên — charge tiền winner, release reserved của loser.
    """
    auction = db.query(BannerAuction).filter(BannerAuction.auction_id == auction_id).first()
    if not auction or auction.status not in ("active", "upcoming"):
        raise HTTPException(status_code=400, detail="Auction không thể kết thúc")

    _settle_auction(db, auction)
    db.commit()

    fire(sio.emit("banner:auction_ended", {
        "auction_id":    auction_id,
        "winner_shop_id": auction.winner_shop_id,
        "final_price":   float(auction.current_price),
    }, room=_BID_ROOM))

    return _fmt_auction(auction)


@router.get("/admin/auctions")
def admin_list_auctions(
    status: str = Query("all"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    _refresh_auction_statuses(db)
    query = db.query(BannerAuction)
    if status != "all":
        query = query.filter(BannerAuction.status == status)
    query = query.order_by(BannerAuction.created_at.desc())
    items, total, pages = paginate(query, page, limit)
    return {"auctions": [_fmt_auction(a, include_bids=False) for a in items], "total": total, "pages": pages}


@router.get("/admin/pending-review")
def admin_pending_review(
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    """Banner shop đã nộp, đang chờ admin duyệt trong hạn 6h."""
    _refresh_auction_statuses(db)
    auctions = (
        db.query(BannerAuction)
        .filter(BannerAuction.banner_status == "pending")
        .order_by(BannerAuction.banner_submitted_at.desc())
        .all()
    )
    return {"pending": [_fmt_auction(a) for a in auctions]}


@router.post("/auctions/{auction_id}/approve")
def approve_banner(
    auction_id: int,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    """Admin duyệt nội dung banner (đã chuyển từ super sang, đồng bộ với
    slot_auctions). Duyệt xong KHÔNG lên ngay — set activates_at = 0h hôm
    sau, chờ activate_due_banner_auctions() promote vào bảng "banners"."""
    a = db.query(BannerAuction).filter(BannerAuction.auction_id == auction_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên đấu giá")
    if a.banner_status != "pending":
        raise HTTPException(status_code=400, detail=f"Banner đang ở trạng thái '{a.banner_status}', không thể duyệt")

    now = datetime.now()
    a.banner_status = "approved"
    a.banner_reviewed_at = now
    a.banner_reject_reason = None
    a.activates_at = _next_midnight(now)
    db.commit()
    return {"message": f"Đã duyệt — sẽ lên trang chủ lúc 0:00 ({a.activates_at})", **_fmt_auction(a)}


@router.post("/auctions/{auction_id}/reject")
def reject_banner(
    auction_id: int,
    body: dict,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    """Admin từ chối nội dung banner. Với win_type='buyout' đã hết
    MAX_BANNER_BUYOUT_SUBMISSIONS lần nộp thì coi như thất bại luôn (huỷ
    vị trí), không đợi shop nộp lại nữa dù còn hạn 6h."""
    a = db.query(BannerAuction).filter(BannerAuction.auction_id == auction_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên đấu giá")
    if a.banner_status != "pending":
        raise HTTPException(status_code=400, detail=f"Banner đang ở trạng thái '{a.banner_status}', không thể từ chối")

    a.banner_status = "rejected"
    a.banner_reviewed_at = datetime.now()
    a.banner_reject_reason = body.get("reason") or "Không đạt yêu cầu"

    if a.win_type == "buyout" and (a.submission_attempts or 0) >= MAX_BANNER_BUYOUT_SUBMISSIONS:
        _forfeit_banner_review(db, a)
        db.commit()
        return {"message": f"Đã từ chối — hết {MAX_BANNER_BUYOUT_SUBMISSIONS} lần nộp, vị trí bị huỷ", **_fmt_auction(a)}

    db.commit()
    return {"message": "Đã từ chối — shop có thể nộp lại ảnh khác", **_fmt_auction(a)}


# ── Socket.io: join/leave auction room ───────────────────────────────────────
# Client gửi: socket.emit("banner:join") để nhận real-time bids

@sio.event
async def banner_join(sid, data):
    """Client tham gia room theo dõi banner auction."""
    await sio.enter_room(sid, _BID_ROOM)
    await sio.emit("banner:joined", {"room": _BID_ROOM}, to=sid)


@sio.event
async def banner_leave(sid, data):
    await sio.leave_room(sid, _BID_ROOM)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _refresh_auction_statuses(db: Session) -> None:
    """Tự động chuyển trạng thái theo thời gian (upcoming→active, active→
    ended), quét vi phạm trễ hạn (thanh toán 30' + duyệt nội dung 6h), và
    tự kích hoạt banner đã duyệt tới mốc 0h — gọi lazy ở đầu mọi endpoint
    đọc, y hệt cách slot_auctions hoạt động."""
    now = datetime.now()
    # upcoming → active
    db.query(BannerAuction).filter(
        BannerAuction.status == "upcoming",
        BannerAuction.start_time <= now,
    ).update({"status": "active"})

    # active → ended (và settle — luôn là win_type='bid', vì buyout đã được
    # settle ngay tại chỗ trong place_bid())
    expired = db.query(BannerAuction).filter(
        BannerAuction.status == "active",
        BannerAuction.end_time <= now,
    ).all()
    for a in expired:
        _settle_auction(db, a)

    db.commit()

    sweep_expired_banner_payments(db)
    sweep_expired_banner_buyout_reviews(db)
    activate_due_banner_auctions(db)


def _settle_auction(db: Session, auction: BannerAuction) -> None:
    """
    Kết thúc phiên đấu giá theo cách THƯỜNG (hết giờ, người trả cao nhất
    thắng) — win_type='bid'. Chỉ trừ THẬT 20% cọc ngay, 80% còn lại VẪN nằm
    reserved (không phải available, cũng chưa thu) chờ 30 phút trả nốt (xem
    POST /auctions/{id}/pay-remaining + sweep_expired_banner_payments).

    Mua đứt (win_type='buyout') được settle NGAY tại chỗ trong place_bid()
    qua _settle_buyout() — không bao giờ đi qua hàm này.
    """
    auction.status = "ended"
    auction.win_type = "bid"
    now = datetime.now()

    if auction.winner_bid_id:
        winner_bid = db.query(BannerBid).filter(BannerBid.bid_id == auction.winner_bid_id).first()
        if winner_bid:
            winner_bid.status = "won"
            w_wallet = db.query(ShopWallet).filter(ShopWallet.shop_id == winner_bid.shop_id).first()
            if w_wallet:
                total = Decimal(str(winner_bid.amount))
                deposit = (total * DEPOSIT_RATE).quantize(Decimal("1"))
                # Trừ THẬT 20% (balance + reserved đều giảm) — 80% còn lại
                # vẫn nằm nguyên trong "reserved" chờ trả nốt trong 30 phút.
                w_wallet.balance  = Decimal(str(w_wallet.balance))  - deposit
                w_wallet.reserved = Decimal(str(w_wallet.reserved)) - deposit
                db.add(ShopWalletTransaction(
                    wallet_id=w_wallet.wallet_id, shop_id=winner_bid.shop_id,
                    amount=-deposit, txn_type="charge",
                    ref_type="auction_win_deposit", ref_id=auction.auction_id,
                    note=f"Cọc 20% thắng banner slot #{auction.slot_id} — phiên #{auction.auction_id}",
                ))
                shop_obj = db.query(Shop).filter(Shop.shop_id == winner_bid.shop_id).first()
                db.add(PlatformTransaction(
                    type="commission", amount=deposit,
                    shop_id=winner_bid.shop_id,
                    shop_name=shop_obj.shop_name if shop_obj else None,
                    status="completed",
                    note=f"Doanh thu cọc 20% banner slot #{auction.slot_id} (phiên #{auction.auction_id})",
                ))
                auction.deposit_amount = deposit
                auction.deposit_charged_at = now
                auction.payment_deadline = now + timedelta(minutes=PAYMENT_WINDOW_MINUTES)

    # Release tất cả loser bids còn active/outbid — không bị ảnh hưởng gì.
    loser_bids = db.query(BannerBid).filter(
        BannerBid.auction_id == auction.auction_id,
        BannerBid.bid_id != auction.winner_bid_id,
        BannerBid.status.in_(["active", "outbid"]),
    ).all()
    for lb in loser_bids:
        lb.status = "refunded"
        lw = db.query(ShopWallet).filter(ShopWallet.shop_id == lb.shop_id).first()
        if lw:
            lw.reserved = Decimal(str(lw.reserved)) - Decimal(str(lb.amount))
            db.add(ShopWalletTransaction(
                wallet_id=lw.wallet_id, shop_id=lb.shop_id,
                amount=lb.amount, txn_type="refund",
                ref_type="auction_loss", ref_id=auction.auction_id,
                note=f"Hoàn tiền — không thắng đấu giá #{auction.auction_id}",
            ))


def _settle_buyout(db: Session, auction: BannerAuction, bid: BannerBid, wallet: ShopWallet) -> None:
    """Mua đứt — trừ THẬT toàn bộ số tiền đang reserve (= bid.amount) NGAY
    tại chỗ (gọi trực tiếp từ place_bid, không đợi hết giờ). review_deadline
    (6h) tính từ lúc trả tiền, tối đa MAX_BANNER_BUYOUT_SUBMISSIONS lần nộp
    nội dung (khác slot chỉ 3 lần)."""
    now = datetime.now()
    amount = Decimal(str(bid.amount))
    bid.status = "won"

    wallet.balance  = Decimal(str(wallet.balance))  - amount
    wallet.reserved = Decimal(str(wallet.reserved)) - amount
    db.add(ShopWalletTransaction(
        wallet_id=wallet.wallet_id, shop_id=bid.shop_id,
        amount=-amount, txn_type="charge",
        ref_type="auction_buyout", ref_id=auction.auction_id,
        note=f"Mua đứt banner slot #{auction.slot_id} — phiên #{auction.auction_id}",
    ))
    shop_obj = db.query(Shop).filter(Shop.shop_id == bid.shop_id).first()
    db.add(PlatformTransaction(
        type="commission", amount=amount, shop_id=bid.shop_id,
        shop_name=shop_obj.shop_name if shop_obj else None, status="completed",
        note=f"Doanh thu mua đứt banner slot #{auction.slot_id} (phiên #{auction.auction_id})",
    ))

    auction.status = "ended"
    auction.win_type = "buyout"
    auction.deposit_amount = amount
    auction.deposit_charged_at = now
    auction.final_paid_at = now
    auction.review_deadline = now + timedelta(hours=REVIEW_WINDOW_HOURS)

    loser_bids = db.query(BannerBid).filter(
        BannerBid.auction_id == auction.auction_id,
        BannerBid.bid_id != bid.bid_id,
        BannerBid.status.in_(["active", "outbid"]),
    ).all()
    for lb in loser_bids:
        lb.status = "refunded"
        lw = db.query(ShopWallet).filter(ShopWallet.shop_id == lb.shop_id).first()
        if lw:
            lw.reserved = Decimal(str(lw.reserved)) - Decimal(str(lb.amount))
            db.add(ShopWalletTransaction(
                wallet_id=lw.wallet_id, shop_id=lb.shop_id,
                amount=lb.amount, txn_type="refund",
                ref_type="auction_loss", ref_id=auction.auction_id,
                note=f"Hoàn tiền — không thắng đấu giá #{auction.auction_id}",
            ))


def _forfeit_banner_payment(db: Session, auction: BannerAuction) -> None:
    """Trễ hạn 30 phút không trả nốt 80% (chỉ win_type='bid') — theo yêu cầu
    người dùng: KHÔNG thả tiền lại cho shop, trừ luôn phần reserved còn lại
    (mất trắng, tính là doanh thu platform), ghi 1 vi phạm. Chỉ người thắng
    bị ảnh hưởng — người thua vẫn được release bình thường (đã làm ở
    _settle_auction lúc kết phiên)."""
    shop_id = auction.winner_shop_id
    remaining = Decimal(str(auction.current_price)) - Decimal(str(auction.deposit_amount or 0))
    if remaining > 0 and shop_id:
        wallet = db.query(ShopWallet).filter(ShopWallet.shop_id == shop_id).first()
        if wallet:
            wallet.balance  = Decimal(str(wallet.balance))  - remaining
            wallet.reserved = Decimal(str(wallet.reserved)) - remaining
            db.add(ShopWalletTransaction(
                wallet_id=wallet.wallet_id, shop_id=shop_id,
                amount=-remaining, txn_type="charge",
                ref_type="banner_forfeit", ref_id=auction.auction_id,
                note=f"Trễ hạn trả nốt 80% banner — mất trắng phần còn giữ (phiên #{auction.auction_id})",
            ))
            shop_obj = db.query(Shop).filter(Shop.shop_id == shop_id).first()
            db.add(PlatformTransaction(
                type="commission", amount=remaining, shop_id=shop_id,
                shop_name=shop_obj.shop_name if shop_obj else None, status="completed",
                note=f"Doanh thu phạt trễ hạn banner slot #{auction.slot_id} (phiên #{auction.auction_id})",
            ))
    auction.status = "forfeited"
    if shop_id:
        v = _get_or_create_violation(db, shop_id)
        v.violation_count = (v.violation_count or 0) + 1
        if v.violation_count >= MAX_VIOLATIONS:
            v.banned = True


def _forfeit_banner_review(db: Session, auction: BannerAuction) -> None:
    """Hết hạn 6h duyệt nội dung hoặc hết số lần nộp cho phép — tiền đã trừ
    100% (buyout) hoặc đã trừ 20%+80% không hoàn, chỉ cần đóng phiên + ghi
    vi phạm (không còn gì để trừ thêm)."""
    auction.status = "forfeited"
    if auction.winner_shop_id:
        v = _get_or_create_violation(db, auction.winner_shop_id)
        v.violation_count = (v.violation_count or 0) + 1
        if v.violation_count >= MAX_VIOLATIONS:
            v.banned = True


def sweep_expired_banner_payments(db: Session) -> int:
    """Lazy-check: phiên win_type='bid' đã ended, quá hạn 30' trả nốt 80%
    mà chưa trả -> forfeit. Gọi ở đầu các endpoint đọc."""
    now = datetime.now()
    expired = (
        db.query(BannerAuction)
        .filter(
            BannerAuction.status == "ended",
            BannerAuction.win_type == "bid",
            BannerAuction.final_paid_at.is_(None),
            BannerAuction.payment_deadline.isnot(None),
            BannerAuction.payment_deadline < now,
        )
        .all()
    )
    for a in expired:
        _forfeit_banner_payment(db, a)
    if expired:
        db.commit()
    return len(expired)


def sweep_expired_banner_buyout_reviews(db: Session) -> int:
    """Lazy-check: phiên win_type='buyout' đã trả tiền, quá hạn 6h nộp+duyệt
    (review_deadline) mà vẫn chưa được duyệt -> forfeit."""
    now = datetime.now()
    expired = (
        db.query(BannerAuction)
        .filter(
            BannerAuction.status == "ended",
            BannerAuction.win_type == "buyout",
            BannerAuction.banner_status != "approved",
            BannerAuction.review_deadline.isnot(None),
            BannerAuction.review_deadline < now,
        )
        .all()
    )
    for a in expired:
        _forfeit_banner_review(db, a)
    if expired:
        db.commit()
    return len(expired)


def activate_due_banner_auctions(db: Session) -> int:
    """Lazy-check: banner đã duyệt (banner_status='approved') nhưng chưa lên
    hệ thống, đã qua mốc activates_at -> promote vào bảng "banners" chính
    thức + chuyển status='live'. Gọi ở đầu các endpoint đọc, y hệt slot."""
    now = datetime.now()
    due = (
        db.query(BannerAuction)
        .filter(
            BannerAuction.banner_status == "approved",
            BannerAuction.status == "ended",
            BannerAuction.activates_at.isnot(None),
            BannerAuction.activates_at <= now,
        )
        .all()
    )
    for a in due:
        a.status = "live"
        db.query(Banner).filter(
            Banner.slot_id == a.slot_id, Banner.status == "active",
        ).update({"status": "inactive"})
        shop = db.query(Shop).filter(Shop.shop_id == a.winner_shop_id).first() if a.winner_shop_id else None
        db.add(Banner(
            slot_id=a.slot_id,
            position=a.slot.position if a.slot else None,
            image_url=a.banner_image_url,
            title=a.banner_title,
            link=a.banner_link,
            shop_id=a.winner_shop_id,
            shop_name=shop.shop_name if shop else None,
            source_auction_id=a.auction_id,
            status="active",
        ))
    if due:
        db.commit()
    return len(due)
