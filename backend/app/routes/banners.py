"""
app/routes/banners.py
----------------------
Banner slot + auction + real-time bidding.

Public:
  GET  /api/v1/banners/slots                   — danh sách slot đang active
  GET  /api/v1/banners/auctions                — danh sách phiên đấu giá

Shop (require shop role):
  POST /api/v1/banners/auctions/{id}/bid       — đặt giá (Redis rate-limit 1 bid/3s)
  GET  /api/v1/banners/my-bids                 — lịch sử bid của shop

Admin:
  POST /api/v1/banners/slots                   — tạo slot
  PUT  /api/v1/banners/slots/{id}              — sửa slot
  POST /api/v1/banners/auctions                — mở phiên đấu giá
  POST /api/v1/banners/auctions/{id}/end       — kết thúc phiên sớm
  GET  /api/v1/banners/admin/auctions          — tất cả phiên (kể cả ended)
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
    BannerSlot, BannerAuction, BannerBid, ShopWallet, ShopWalletTransaction,
)
from app.models.shop import Shop
from app.utils.helpers import paginate
from app.utils.upload_service import save_upload_file
from app.websocket.connection_manager import sio, fire

router = APIRouter(prefix="/api/v1/banners", tags=["Banners"])

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
    }


def _fmt_auction(a: BannerAuction, include_bids=False) -> dict:
    data = {
        "auction_id":     a.auction_id,
        "slot_id":        a.slot_id,
        "slot_name":      a.slot.name if a.slot else None,
        "slot_position":  a.slot.position if a.slot else None,
        "start_time":     str(a.start_time),
        "end_time":       str(a.end_time),
        "status":         a.status,
        "start_price":    float(a.start_price),
        "current_price":  float(a.current_price),
        "winner_shop_id": a.winner_shop_id,
        "winner_shop":    a.winner_shop.shop_name if a.winner_shop else None,
        "bid_count":      len(a.bids) if include_bids else None,
        # Nội dung banner nộp sau khi thắng — xem POST /auctions/{id}/submit
        "banner_image_url":     a.banner_image_url,
        "banner_title":         a.banner_title,
        "banner_link":          a.banner_link,
        "banner_status":        a.banner_status,
        "banner_reject_reason": a.banner_reject_reason,
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
    Điều kiện "đang live": auction đã ended, banner đã được duyệt
    (banner_status='approved'), slot vẫn đang active. Mỗi slot chỉ lấy đúng 1
    banner — auction được duyệt gần nhất (banner_reviewed_at desc).
    """
    query = (
        db.query(BannerAuction)
        .join(BannerSlot, BannerAuction.slot_id == BannerSlot.slot_id)
        .filter(
            BannerAuction.status == "ended",
            BannerAuction.banner_status == "approved",
            BannerSlot.is_active == True,
        )
    )
    if position:
        query = query.filter(BannerSlot.position == position)
    auctions = query.order_by(BannerAuction.banner_reviewed_at.desc()).all()

    seen_slots: set[int] = set()
    result = []
    for a in auctions:
        if a.slot_id in seen_slots:
            continue  # đã có banner mới hơn cho slot này rồi
        seen_slots.add(a.slot_id)
        result.append({
            "position":   a.slot.position if a.slot else None,
            "slot_id":    a.slot_id,
            "slot_name":  a.slot.name if a.slot else None,
            "auction_id": a.auction_id,
            "image_url":  a.banner_image_url,
            "title":      a.banner_title,
            "link":       a.banner_link,
            "shop_name":  a.winner_shop.shop_name if a.winner_shop else None,
            "reviewed_at": str(a.banner_reviewed_at) if a.banner_reviewed_at else None,
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
    """
    _refresh_auction_statuses(db)
    auction = db.query(BannerAuction).filter(BannerAuction.auction_id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction.status != "active":
        raise HTTPException(status_code=400, detail=f"Phiên đấu giá không active (status: {auction.status})")

    amount = Decimal(str(body.get("amount", 0)))
    min_bid = Decimal(str(auction.current_price)) + Decimal("1000")
    if amount < min_bid:
        raise HTTPException(
            status_code=400,
            detail=f"Giá tối thiểu là {float(min_bid):,.0f}đ (giá hiện tại + 1,000đ)"
        )

    shop_id = current_user.user_id

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
        "wallet_available": float(available) - float(amount),
    }


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
):
    """Shop upload ảnh banner (dùng trước khi gọi /auctions/{id}/submit) —
    tái dùng save_upload_file() y hệt cách /products/upload-image làm, chỉ
    khác subfolder để tách riêng thư mục ảnh banner."""
    url = await save_upload_file(file, "banners")
    return {"url": url}


@router.post("/auctions/{auction_id}/submit")
def submit_banner(
    auction_id: int,
    body: dict,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    """Shop nộp ảnh banner sau khi thắng đấu giá — bắt buộc auction đã kết
    thúc (status='ended') và đúng là shop đã thắng. Nộp xong chuyển sang
    banner_status='pending', chờ superadmin duyệt (POST /api/super/banners/
    {id}/approve) mới thật sự lên site (xem get_live_banners() ở trên)."""
    _refresh_auction_statuses(db)
    auction = db.query(BannerAuction).filter(BannerAuction.auction_id == auction_id).first()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction.status != "ended":
        raise HTTPException(status_code=400, detail="Phiên đấu giá chưa kết thúc")
    if auction.winner_shop_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Bạn không phải người thắng phiên đấu giá này")

    image_url = (body.get("image_url") or "").strip()
    if not image_url:
        raise HTTPException(status_code=400, detail="Thiếu ảnh banner")

    auction.banner_image_url  = image_url
    auction.banner_title      = (body.get("title") or "").strip() or None
    auction.banner_link       = (body.get("link") or "").strip() or None
    auction.banner_status     = "pending"
    auction.banner_submitted_at = datetime.now()
    auction.banner_reviewed_at  = None
    auction.banner_reject_reason = None
    db.commit()

    return {"message": "Đã nộp banner, đang chờ superadmin duyệt", **_fmt_auction(auction)}


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
    for field in ("name", "position", "width", "height", "duration_days", "is_active"):
        if field in body:
            setattr(slot, field, body[field])
    if "base_price" in body:
        slot.base_price = Decimal(str(body["base_price"]))
    db.commit()
    return _fmt_slot(slot)


@router.post("/auctions")
def create_auction(
    body: dict,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    """
    Mở phiên đấu giá cho 1 slot.
    duration_hours: thời gian phiên (mặc định 24h).
    """
    slot_id = body.get("slot_id")
    slot = db.query(BannerSlot).filter(BannerSlot.slot_id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

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
    """Tự động chuyển trạng thái theo thời gian (upcoming→active, active→ended)."""
    now = datetime.now()
    # upcoming → active
    db.query(BannerAuction).filter(
        BannerAuction.status == "upcoming",
        BannerAuction.start_time <= now,
    ).update({"status": "active"})

    # active → ended (và settle)
    expired = db.query(BannerAuction).filter(
        BannerAuction.status == "active",
        BannerAuction.end_time <= now,
    ).all()
    for a in expired:
        _settle_auction(db, a)

    db.commit()


def _settle_auction(db: Session, auction: BannerAuction) -> None:
    """
    Kết thúc phiên đấu giá:
    - Charge tiền winner (reserved → balance giảm, không phải release)
    - Xoá reserved của winner
    - Release reserved của tất cả loser
    """
    auction.status = "ended"
    now = datetime.now()

    if auction.winner_bid_id:
        winner_bid = db.query(BannerBid).filter(BannerBid.bid_id == auction.winner_bid_id).first()
        if winner_bid:
            winner_bid.status = "won"
            w_wallet = db.query(ShopWallet).filter(ShopWallet.shop_id == winner_bid.shop_id).first()
            if w_wallet:
                win_amount = Decimal(str(winner_bid.amount))
                # Trừ tiền thật (balance + release reserved)
                w_wallet.balance  = Decimal(str(w_wallet.balance))  - win_amount
                w_wallet.reserved = Decimal(str(w_wallet.reserved)) - win_amount
                db.add(ShopWalletTransaction(
                    wallet_id=w_wallet.wallet_id, shop_id=winner_bid.shop_id,
                    amount=-win_amount, txn_type="charge",
                    ref_type="auction_win", ref_id=auction.auction_id,
                    note=f"Thanh toán banner slot #{auction.slot_id} — thắng đấu giá #{auction.auction_id}",
                ))

    # Release tất cả loser bids còn active/outbid
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
