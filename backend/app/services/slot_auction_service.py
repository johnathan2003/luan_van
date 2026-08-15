"""
app/services/slot_auction_service.py
----------------------------------------
Logic dùng chung cho cả 2 hệ đấu giá "gắn sản phẩm vào vị trí đặc quyền":
  - Flash slot (app.models.slot_auctions.FlashSlot/FlashSlotAuction/FlashSlotBid)
  - Top slot   (app.models.slot_auctions.TopSlot/TopSlotAuction/TopSlotBid)

Cả 2 hệ gần giống nhau về cơ chế, chỉ khác bảng, hiệu ứng lúc "lên hệ thống"
(top slot sinh thêm ProductBoost), và 1 điểm khác biệt QUAN TRỌNG:
  - Flash slot: CÓ mua đứt (endPrice) — end_price NOT NULL.
  - Top slot:   KHÔNG có mua đứt — end_price luôn NULL, chỉ đấu giá thường.
    (Toàn bộ nhánh buyout dưới đây tự động bị bỏ qua khi end_price is None,
    không cần if/else riêng theo family.)
Vì vậy mọi hàm ở đây nhận model class làm tham số thay vì viết 2 lần.

Luồng tiền (đã chốt với người dùng):
  - Bid: không khoá/reserve tiền, chỉ kiểm tra available >= amount lúc đặt.
    Shop chọn sản phẩm quảng bá NGAY từ lần bid đầu tiên trong phiên — các
    bid sau của cùng shop phải giữ nguyên product_id đó (không đổi giữa
    chừng).
  - (Chỉ Flash) Chạm/vượt end_price -> mua đứt (buyout), trừ thẳng 100%
    NGAY. Để tránh lợi dụng mua đứt cắt ngang phiên vào phút chót, mua đứt
    bị KHOÁ trong 6 tiếng cuối trước end_time — trong khung giờ đó, trả >=
    end_price vẫn chỉ được tính là 1 bid thường (không thắng ngay).
  - Hết giờ bình thường -> người trả cao nhất thắng, trừ thẳng 20% ngay,
    hạn 30 phút trả nốt 80%. Trễ hạn -> 1 vi phạm (ghi shop_bid_violations,
    đủ 3 -> banned), 20% đã trừ MẤT LUÔN (không hoàn), slot bỏ trống.
  - Trả đủ tiền (100% hoặc 20%+80%) -> winner nộp nội dung -> admin duyệt.
    Với win_type='bid': không giới hạn số lần nộp lại, hạn duyệt 6h tính từ
    LẦN NỘP ĐẦU TIÊN. Với win_type='buyout': hạn 6h tính NGAY TỪ LÚC TRẢ
    TIỀN (final_paid_at), tối đa 3 lần nộp trong hạn đó — hết hạn hoặc hết
    3 lần mà chưa được duyệt thì coi như thất bại: 1 vi phạm, tiền mất luôn
    (không hoàn vì đã trừ 100%), slot bỏ trống.
  - Duyệt xong không lên ngay, chờ tới 0:00 hôm sau (activates_at) mới tự
    động public khi có người đọc trang (activate_due_auctions, gọi lazy —
    không cần job nền riêng).
"""
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, Type

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.shop import Shop
from app.models.wallet_auction import ShopWallet, ShopWalletTransaction
from app.models.admin_config import PlatformTransaction
from app.models.slot_auctions import ShopBidViolation, ProductBoost, TopSlotAuction

DEPOSIT_RATE = Decimal("0.2")
PAYMENT_WINDOW_MINUTES = 30
REVIEW_WINDOW_HOURS = 6
MAX_VIOLATIONS = 3
BID_COOLDOWN_SECONDS = 10
BUYOUT_LOCK_BEFORE_END = timedelta(hours=6)   # khoá mua đứt trong 6h cuối trước end_time
MAX_BUYOUT_SUBMISSIONS = 3                     # tối đa 3 lần nộp nội dung — chỉ áp dụng win_type='buyout'


# ── Helpers ──────────────────────────────────────────────────────────────────

def _next_midnight(after: datetime) -> datetime:
    """Mốc 0:00 gần nhất SAU thời điểm `after`."""
    d = (after + timedelta(days=1)).date()
    return datetime(d.year, d.month, d.day)


def _get_or_create_violation(db: Session, shop_id: int) -> ShopBidViolation:
    v = db.query(ShopBidViolation).filter(ShopBidViolation.shop_id == shop_id).first()
    if not v:
        v = ShopBidViolation(shop_id=shop_id, violation_count=0, banned=False)
        db.add(v)
        db.flush()
    return v


def is_shop_banned(db: Session, shop_id: int) -> bool:
    v = db.query(ShopBidViolation).filter(ShopBidViolation.shop_id == shop_id).first()
    return bool(v and v.banned)


def _charge_shop(db: Session, shop_id: int, amount: Decimal, ref_type: str, ref_id: int, note: str) -> None:
    """Trừ tiền thật từ ShopWallet.balance + ghi log + ghi doanh thu platform."""
    wallet = db.query(ShopWallet).filter(ShopWallet.shop_id == shop_id).first()
    if not wallet:
        raise HTTPException(400, "Shop chưa có ví — không thể trừ tiền")
    available = Decimal(str(wallet.balance)) - Decimal(str(wallet.reserved))
    if amount > available:
        raise HTTPException(400, f"Số dư khả dụng không đủ ({float(available):,.0f}đ < {float(amount):,.0f}đ)")
    wallet.balance = Decimal(str(wallet.balance)) - amount
    db.add(ShopWalletTransaction(
        wallet_id=wallet.wallet_id, shop_id=shop_id, amount=-amount,
        txn_type="charge", ref_type=ref_type, ref_id=ref_id, note=note,
    ))
    shop = db.query(Shop).filter(Shop.shop_id == shop_id).first()
    db.add(PlatformTransaction(
        type="commission", amount=amount, shop_id=shop_id,
        shop_name=shop.shop_name if shop else None, status="completed", note=note,
    ))


# ── Đặt giá ──────────────────────────────────────────────────────────────────

def place_bid(db: Session, AuctionModel: Type, BidModel: Type, auction_id: int, shop_id: int,
              amount: Decimal, product_id: int) -> dict:
    from app.models.product import Product

    if is_shop_banned(db, shop_id):
        raise HTTPException(403, "Tài khoản bị khoá đấu giá do vi phạm thanh toán quá 3 lần")

    auction = db.query(AuctionModel).filter(AuctionModel.auction_id == auction_id).first()
    if not auction:
        raise HTTPException(404, "Phiên đấu giá không tồn tại")
    now = datetime.now()
    if auction.status != "active":
        if auction.status == "upcoming" and auction.start_time <= now <= auction.end_time:
            auction.status = "active"
        else:
            raise HTTPException(400, "Phiên đấu giá không ở trạng thái đang chạy")
    if now > auction.end_time:
        settle_auction(db, AuctionModel, BidModel, auction_id)
        raise HTTPException(400, "Phiên đấu giá đã kết thúc")

    if amount <= Decimal(str(auction.current_price)):
        raise HTTPException(400, f"Giá phải cao hơn giá hiện tại ({float(auction.current_price):,.0f}đ)")

    # Sản phẩm chọn 1 lần trước bid đầu tiên — các bid sau của cùng shop
    # phải giữ nguyên, không cho đổi giữa chừng.
    if not product_id:
        raise HTTPException(400, "Thiếu product_id — chọn sản phẩm muốn quảng bá trước khi đặt giá")
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(404, "Sản phẩm không tồn tại")
    if product.shop_id != shop_id:
        raise HTTPException(403, "Sản phẩm không thuộc shop của bạn")

    first_bid = (
        db.query(BidModel)
        .filter(BidModel.auction_id == auction_id, BidModel.shop_id == shop_id)
        .order_by(BidModel.created_at.asc())
        .first()
    )
    if first_bid and first_bid.product_id and first_bid.product_id != product_id:
        raise HTTPException(400, "Bạn đã chọn sản phẩm khác cho phiên này — không thể đổi giữa chừng")

    # Cooldown 10s / shop / phiên
    last_bid = (
        db.query(BidModel)
        .filter(BidModel.auction_id == auction_id, BidModel.shop_id == shop_id)
        .order_by(BidModel.created_at.desc())
        .first()
    )
    if last_bid and (now - last_bid.created_at).total_seconds() < BID_COOLDOWN_SECONDS:
        raise HTTPException(429, f"Vui lòng chờ {BID_COOLDOWN_SECONDS}s giữa 2 lần đặt giá")

    # Chỉ kiểm tra đủ tiền — KHÔNG khoá/reserve (chỉ trừ thật khi thắng)
    wallet = db.query(ShopWallet).filter(ShopWallet.shop_id == shop_id).first()
    available = (Decimal(str(wallet.balance)) - Decimal(str(wallet.reserved))) if wallet else Decimal("0")
    if amount > available:
        raise HTTPException(400, f"Số dư khả dụng không đủ ({float(available):,.0f}đ < {float(amount):,.0f}đ)")

    bid = BidModel(auction_id=auction_id, shop_id=shop_id, amount=amount, product_id=product_id)
    db.add(bid)
    auction.current_price = amount
    db.flush()

    end_price = Decimal(str(auction.end_price)) if auction.end_price is not None else None
    buyout_locked = (auction.end_time - now) < BUYOUT_LOCK_BEFORE_END
    if end_price is not None and amount >= end_price and not buyout_locked:
        # Mua đứt — thắng ngay lập tức, trừ 100% ngay
        auction.winner_bid_id = bid.bid_id
        settle_auction(db, AuctionModel, BidModel, auction_id, win_type="buyout")
        db.commit()
        return {"bid_id": bid.bid_id, "amount": float(amount), "buyout": True}

    db.commit()
    return {
        "bid_id": bid.bid_id, "amount": float(amount), "buyout": False,
        "buyout_locked": bool(end_price is not None and amount >= end_price and buyout_locked),
    }


# ── Kết phiên ────────────────────────────────────────────────────────────────

def settle_auction(db: Session, AuctionModel: Type, BidModel: Type, auction_id: int, win_type: Optional[str] = None) -> None:
    """Kết phiên — gọi khi hết giờ (win_type=None, tự xác định người thắng
    theo giá cao nhất) hoặc khi mua đứt (win_type='buyout', đã biết bid thắng)."""
    auction = db.query(AuctionModel).filter(AuctionModel.auction_id == auction_id).first()
    if not auction or auction.status not in ("upcoming", "active"):
        return
    now = datetime.now()

    winner_bid = None
    if win_type == "buyout" and auction.winner_bid_id:
        winner_bid = db.query(BidModel).filter(BidModel.bid_id == auction.winner_bid_id).first()
    else:
        winner_bid = (
            db.query(BidModel)
            .filter(BidModel.auction_id == auction_id)
            .order_by(BidModel.amount.desc(), BidModel.created_at.asc())
            .first()
        )
        win_type = "bid"

    if not winner_bid:
        auction.status = "ended"
        db.commit()
        return

    auction.winner_bid_id = winner_bid.bid_id
    auction.winner_shop_id = winner_bid.shop_id
    auction.winner_product_id = winner_bid.product_id
    auction.win_type = win_type
    auction.status = "ended"

    total = Decimal(str(winner_bid.amount))
    slot_label = f"{AuctionModel.__tablename__}#{auction.slot_id}"

    if win_type == "buyout":
        _charge_shop(db, winner_bid.shop_id, total, "slot_auction_buyout", auction_id,
                     f"Mua đứt {slot_label} — phiên #{auction_id}")
        auction.deposit_amount = total
        auction.deposit_charged_at = now
        auction.final_paid_at = now   # đã trả đủ 100% ngay
        # Countdown 6h nộp+duyệt nội dung tính NGAY từ lúc trả tiền (không
        # đợi tới lần nộp đầu tiên như luồng bid thường) — tối đa 3 lần nộp
        # trong hạn này (xem submit_content/review_content).
        auction.review_deadline = now + timedelta(hours=REVIEW_WINDOW_HOURS)
    else:
        deposit = (total * DEPOSIT_RATE).quantize(Decimal("1"))
        _charge_shop(db, winner_bid.shop_id, deposit, "slot_auction_deposit", auction_id,
                     f"Cọc 20% thắng {slot_label} — phiên #{auction_id}")
        auction.deposit_amount = deposit
        auction.deposit_charged_at = now
        auction.payment_deadline = now + timedelta(minutes=PAYMENT_WINDOW_MINUTES)

    db.commit()


def pay_remaining(db: Session, AuctionModel: Type, auction_id: int, shop_id: int) -> dict:
    """Winner trả nốt 80% còn lại (chỉ áp dụng cho win_type='bid')."""
    auction = db.query(AuctionModel).filter(AuctionModel.auction_id == auction_id).first()
    if not auction:
        raise HTTPException(404, "Phiên đấu giá không tồn tại")
    if auction.winner_shop_id != shop_id:
        raise HTTPException(403, "Bạn không phải người thắng phiên này")
    if auction.win_type != "bid" or auction.final_paid_at:
        raise HTTPException(400, "Phiên này không cần thanh toán thêm")
    now = datetime.now()
    if auction.payment_deadline and now > auction.payment_deadline:
        _forfeit(db, auction, shop_id)
        db.commit()
        raise HTTPException(400, "Đã quá hạn thanh toán 30 phút — vị trí đã bị huỷ")

    # current_price tăng dần theo mỗi bid hợp lệ -> lúc kết phiên nó chính
    # là giá của winner_bid, không cần join lại bảng bid.
    total = Decimal(str(auction.current_price))
    remaining = total - Decimal(str(auction.deposit_amount or 0))

    slot_label = f"{AuctionModel.__tablename__}#{auction.slot_id}"
    _charge_shop(db, shop_id, remaining, "slot_auction_final", auction_id,
                 f"Thanh toán nốt 80% {slot_label} — phiên #{auction_id}")
    auction.final_paid_at = now
    db.commit()
    return {"message": "Đã thanh toán đủ", "final_paid_at": now.isoformat()}


def _forfeit(db: Session, auction, shop_id: int) -> None:
    """Huỷ phiên do shop không hoàn tất nghĩa vụ (trễ hạn trả nốt 80%, hoặc
    hết hạn/hết lượt nộp nội dung mà chưa được duyệt) — slot bỏ trống, ghi
    1 vi phạm cho shop. Tiền đã đóng (đặt cọc hoặc trả đủ endPrice) không
    hoàn lại — coi như phí phạt."""
    auction.status = "forfeited"
    v = _get_or_create_violation(db, shop_id)
    v.violation_count = (v.violation_count or 0) + 1
    if v.violation_count >= MAX_VIOLATIONS:
        v.banned = True


def sweep_expired_payments(db: Session, AuctionModel: Type) -> int:
    """Lazy-check: quét các phiên đã 'ended' (win_type='bid') quá hạn 30
    phút mà chưa trả nốt 80% -> forfeit. Gọi ở đầu các endpoint đọc."""
    now = datetime.now()
    expired = (
        db.query(AuctionModel)
        .filter(
            AuctionModel.status == "ended",
            AuctionModel.win_type == "bid",
            AuctionModel.final_paid_at.is_(None),
            AuctionModel.payment_deadline.isnot(None),
            AuctionModel.payment_deadline < now,
        )
        .all()
    )
    for a in expired:
        _forfeit(db, a, a.winner_shop_id)
    if expired:
        db.commit()
    return len(expired)


def sweep_expired_buyout_reviews(db: Session, AuctionModel: Type) -> int:
    """Lazy-check: quét các phiên win_type='buyout' đã trả tiền, quá hạn 6h
    nộp+duyệt nội dung (review_deadline) mà vẫn chưa được duyệt -> forfeit.
    Gọi ở đầu các endpoint đọc, song song với sweep_expired_payments."""
    now = datetime.now()
    expired = (
        db.query(AuctionModel)
        .filter(
            AuctionModel.status == "ended",
            AuctionModel.win_type == "buyout",
            AuctionModel.submission_status != "approved",
            AuctionModel.review_deadline.isnot(None),
            AuctionModel.review_deadline < now,
        )
        .all()
    )
    for a in expired:
        _forfeit(db, a, a.winner_shop_id)
    if expired:
        db.commit()
    return len(expired)


# ── Nội dung — nộp / duyệt / kích hoạt ────────────────────────────────────────

def submit_content(db: Session, AuctionModel: Type, auction_id: int, shop_id: int,
                    image_url: Optional[str], title: Optional[str], link: Optional[str]) -> dict:
    """Nộp ảnh/nội dung sau khi thắng — sản phẩm đã được chốt sẵn từ lúc
    đặt giá (auction.winner_product_id), ở đây chỉ còn nộp ảnh quảng bá."""
    auction = db.query(AuctionModel).filter(AuctionModel.auction_id == auction_id).first()
    if not auction:
        raise HTTPException(404, "Phiên đấu giá không tồn tại")
    if auction.winner_shop_id != shop_id:
        raise HTTPException(403, "Bạn không phải người thắng phiên này")
    if not auction.final_paid_at:
        raise HTTPException(400, "Cần thanh toán đủ trước khi nộp nội dung")
    if auction.submission_status == "approved":
        raise HTTPException(400, "Nội dung đã được duyệt, không thể nộp lại")

    now = datetime.now()

    if auction.win_type == "buyout":
        if auction.review_deadline and now > auction.review_deadline:
            _forfeit(db, auction, shop_id)
            db.commit()
            raise HTTPException(400, "Đã quá hạn 6 tiếng để nộp/duyệt nội dung — vị trí đã bị huỷ")
        if (auction.submission_attempts or 0) >= MAX_BUYOUT_SUBMISSIONS:
            raise HTTPException(400, f"Đã hết {MAX_BUYOUT_SUBMISSIONS} lần nộp nội dung cho phép")

    auction.submission_image_url = image_url
    auction.submission_title = title
    auction.submission_link = link
    auction.submission_status = "pending"
    auction.submitted_at = now
    auction.submission_attempts = (auction.submission_attempts or 0) + 1
    if not auction.review_deadline:
        # Chỉ áp dụng cho win_type='bid' — buyout đã set review_deadline
        # ngay lúc settle_auction (tính từ lúc trả tiền, không phải lúc nộp).
        auction.review_deadline = now + timedelta(hours=REVIEW_WINDOW_HOURS)
    db.commit()

    remaining = None
    if auction.win_type == "buyout":
        remaining = MAX_BUYOUT_SUBMISSIONS - auction.submission_attempts
    return {"message": "Đã nộp nội dung, chờ admin duyệt", "attempts_remaining": remaining}


def review_content(db: Session, AuctionModel: Type, auction_id: int, approve: bool, reject_reason: Optional[str] = None) -> dict:
    auction = db.query(AuctionModel).filter(AuctionModel.auction_id == auction_id).first()
    if not auction:
        raise HTTPException(404, "Phiên đấu giá không tồn tại")
    if auction.submission_status != "pending":
        raise HTTPException(400, "Không có nội dung đang chờ duyệt")
    now = datetime.now()
    auction.reviewed_at = now
    if approve:
        auction.submission_status = "approved"
        auction.activates_at = _next_midnight(now)
        if auction.display_until is None:
            auction.display_until = auction.activates_at + timedelta(days=auction.display_duration_days or 2)
        db.commit()
        return {"message": "Đã duyệt"}

    # Từ chối — với buyout, nếu đã hết 3 lần nộp thì coi như thất bại luôn,
    # không đợi shop nộp lại nữa (dù còn hạn 6h).
    auction.submission_status = "rejected"
    auction.reject_reason = reject_reason
    if auction.win_type == "buyout" and (auction.submission_attempts or 0) >= MAX_BUYOUT_SUBMISSIONS:
        _forfeit(db, auction, auction.winner_shop_id)
        db.commit()
        return {"message": f"Đã từ chối — hết {MAX_BUYOUT_SUBMISSIONS} lần nộp, vị trí bị huỷ"}

    db.commit()
    return {"message": "Đã từ chối, chờ shop nộp lại"}


def notify_shops_of_new_auction(db: Session, auction, slot, family: str) -> int:
    """Báo cho TẤT CẢ user role 'shop' ngay khi admin mở phiên — vì mở phiên
    bắt buộc cách giờ start_time >= 1 ngày (enforce ở route tạo phiên bên
    super), gửi ngay lúc này tự động thoả điều kiện báo trước tối thiểu 1
    ngày, không cần job lịch riêng.

    Tái dùng đúng pattern _broadcast_system_notification() (app/routes/
    admin.py) — 1 dòng Notification/user + đẩy real-time qua socket."""
    from app.models.user import User as UserModel, Role, UserRole
    from app.services.notification_service import create_notification

    role_obj = db.query(Role).filter(Role.role_name == "shop").first()
    if not role_obj:
        return 0
    shop_user_ids = [
        ur.user_id for ur in db.query(UserRole).filter(UserRole.role_id == role_obj.role_id).all()
    ]
    if not shop_user_ids:
        return 0
    users = (
        db.query(UserModel)
        .filter(UserModel.user_id.in_(shop_user_ids), UserModel.status == "active")
        .all()
    )

    label = "Flash Sale" if family == "flash" else "Top sản phẩm"
    rules = auction.content_rules or (slot.content_rules if slot else None) or "Xem chi tiết tại trang đấu giá"
    w = auction.image_width or (slot.image_width if slot else None)
    h = auction.image_height or (slot.image_height if slot else None)
    fmt = auction.image_format or (slot.image_format if slot else None)
    size_note = f"{w}x{h}" if w and h else "chưa quy định"

    title = f"Phiên đấu giá mới: {slot.name if slot else label}"
    message = (
        f"Slot: {label} — {slot.name if slot else ''}\n"
        f"Bắt đầu: {auction.start_time} — Kết thúc: {auction.end_time}\n"
        f"Giá khởi điểm: {float(auction.start_price):,.0f}đ — endPrice (mua đứt): {float(auction.end_price):,.0f}đ\n"
        f"Kích thước ảnh: {size_note}" + (f", định dạng: {fmt}" if fmt else "") + "\n"
        f"Quy định nội dung: {rules}"
    )
    action_url = f"/shop/slot-auctions/{family}/{auction.auction_id}"

    count = 0
    for u in users[:500]:
        try:
            create_notification(
                db, u.user_id, title, message,
                notif_type="slot_auction_opened",
                related_entity_type=f"{family}_slot_auction",
                related_entity_id=auction.auction_id,
                action_url=action_url,
                data={
                    "family": family, "auction_id": auction.auction_id,
                    "slot_id": auction.slot_id, "start_price": float(auction.start_price),
                    "end_price": float(auction.end_price),
                },
            )
            count += 1
        except Exception:
            pass
    return count


def activate_due_auctions(db: Session, AuctionModel: Type, is_top: bool = False) -> int:
    """Lazy-check: các phiên đã duyệt (approved) và đã qua mốc activates_at
    nhưng còn status='ended' -> chuyển 'live'. Nếu là top slot thì sinh
    thêm ProductBoost. Gọi ở đầu các endpoint công khai (GET flash-sale,
    GET products liên quan/tìm kiếm...)."""
    now = datetime.now()
    due = (
        db.query(AuctionModel)
        .filter(
            AuctionModel.status == "ended",
            AuctionModel.submission_status == "approved",
            AuctionModel.activates_at.isnot(None),
            AuctionModel.activates_at <= now,
        )
        .all()
    )
    for a in due:
        a.status = "live"
        if is_top and a.winner_product_id:
            exists = db.query(ProductBoost).filter(ProductBoost.source_auction_id == a.auction_id).first()
            if not exists:
                db.add(ProductBoost(
                    product_id=a.winner_product_id,
                    source_auction_id=a.auction_id,
                    expires_at=a.display_until or (now + timedelta(days=a.display_duration_days or 2)),
                ))
    if due:
        db.commit()
    return len(due)
