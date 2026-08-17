"""
app/routes/wallet.py
---------------------
Shop wallet API — ví tiền shop, hệ thống demo (không có tiền thật).

Shop endpoints (require shop role):
  GET  /api/v1/wallet/me                       — số dư + reserved + auction_fund + available
  GET  /api/v1/wallet/transactions              — lịch sử giao dịch
  POST /api/v1/wallet/deposit/start              — bắt đầu nạp tiền demo (chọn phương thức) → tạo giao dịch pending
  GET  /api/v1/wallet/deposit/status/{txn_id}    — trạng thái nạp tiền demo (dùng để poll từ trang QR/simulator)
  POST /api/v1/wallet/deposit/confirm/{txn_id}   — "giả bộ thanh toán xong" ở trang simulator → cộng thẳng vào balance
  POST /api/v1/wallet/deposit/regenerate/{txn_id} — tạo lại phiên nạp khi đã hết hạn
  POST /api/v1/wallet/allocate-auction           — chuyển từ Khả dụng sang Tiền đấu giá (nhãn tự đánh dấu, tức thời, không qua admin)

Admin endpoints (require superadmin):
  GET  /api/v1/wallet/admin/wallets              — xem tổng số dư ví của từng shop (chỉ xem)

Ghi chú: đây là hệ thống demo phục vụ đồ án — không có cổng thanh toán thật,
không có tiền thật nào được chuyển. Nạp tiền là tự động 100% (shop tự "giả
bộ thanh toán xong" ở trang simulator), không cần admin duyệt.
"""
from decimal import Decimal
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import require_shop_owner, require_superadmin
from app.models.user import User
from app.models.wallet_auction import ShopWallet, ShopWalletTransaction
from app.models.shop import Shop
from app.utils.helpers import paginate

# TTL của phiên nạp tiền demo — giống MOMO_DEMO_TTL_SECONDS trong
# payment_service.py, chỉ tách hằng số riêng vì đây là 1 luồng độc lập
# (nạp ví, không gắn với order/Payment).
WALLET_DEPOSIT_TTL_SECONDS = 90

router = APIRouter(prefix="/api/v1/wallet", tags=["Wallet"])

# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_create_wallet(db: Session, shop_id: int) -> ShopWallet:
    wallet = db.query(ShopWallet).filter(ShopWallet.shop_id == shop_id).first()
    if not wallet:
        wallet = ShopWallet(shop_id=shop_id, balance=Decimal("0"), reserved=Decimal("0"), auction_fund=Decimal("0"))
        db.add(wallet)
        db.flush()
    return wallet


def _fmt_wallet(w: ShopWallet) -> dict:
    balance      = float(w.balance)
    reserved     = float(w.reserved)
    auction_fund = float(w.auction_fund)
    return {
        "wallet_id":     w.wallet_id,
        "shop_id":       w.shop_id,
        "balance":       balance,
        "reserved":      reserved,
        "auction_fund":  auction_fund,
        "available":     round(balance - reserved, 2),
    }


def _fmt_txn(t: ShopWalletTransaction) -> dict:
    return {
        "txn_id":    t.txn_id,
        "amount":    float(t.amount),
        "txn_type":  t.txn_type,
        "ref_type":  t.ref_type,
        "ref_id":    t.ref_id,
        "note":      t.note,
        "created_at": str(t.created_at),
    }


def _owned_txn_or_404(db: Session, txn_id: int, current_user: User) -> ShopWalletTransaction:
    """Chặn shop A xem/xác nhận giao dịch nạp tiền của shop B."""
    txn = db.query(ShopWalletTransaction).filter(
        ShopWalletTransaction.txn_id == txn_id,
        ShopWalletTransaction.shop_id == current_user.user_id,
        ShopWalletTransaction.ref_type == "mock_deposit",
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Không tìm thấy giao dịch nạp tiền")
    return txn


def _deposit_status(txn: ShopWalletTransaction) -> str:
    if txn.txn_type == "deposit":
        return "success"
    if txn.txn_type == "deposit_rejected":
        return "expired"
    return "pending"


# ── Shop: xem ví ─────────────────────────────────────────────────────────────

@router.get("/me")
def get_my_wallet(
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    wallet = _get_or_create_wallet(db, current_user.user_id)
    db.commit()
    shop = db.query(Shop).filter(Shop.shop_id == current_user.user_id).first()
    return {
        **_fmt_wallet(wallet),
        "shop_name": shop.shop_name if shop else None,
    }


@router.get("/transactions")
def get_transactions(
    page:  int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    txn_type: str | None = Query(None),
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    wallet = _get_or_create_wallet(db, current_user.user_id)
    db.commit()
    query = db.query(ShopWalletTransaction).filter(ShopWalletTransaction.wallet_id == wallet.wallet_id)
    if txn_type:
        query = query.filter(ShopWalletTransaction.txn_type == txn_type)
    query = query.order_by(ShopWalletTransaction.created_at.desc())
    items, total, pages = paginate(query, page, limit)
    return {"transactions": [_fmt_txn(t) for t in items], "total": total, "pages": pages}


# ── Shop: nạp tiền demo (tự động 100%, không qua admin) ─────────────────────
# Luồng: chọn số tiền + phương thức (Momo/VNPay/ZaloPay demo) trên WalletPage
# → POST /deposit/start → mở trang QR (WalletDepositQRPage, poll /deposit/status)
# → bấm "Quét QR" mở trang giả lập app thanh toán ở tab mới
#   (WalletDepositSimulatorPage) → bấm "Xác nhận thanh toán" → POST
#   /deposit/confirm/{txn_id} → tab đó tự đóng, tab gốc phát hiện qua polling
#   → tự cộng vào balance, không cần ai duyệt.

@router.post("/deposit/start")
def start_deposit(
    body: dict,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    amount = Decimal(str(body.get("amount", 0)))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Số tiền phải lớn hơn 0")
    if amount > 100_000_000:
        raise HTTPException(status_code=400, detail="Tối đa 100,000,000đ mỗi lần nạp")

    wallet = _get_or_create_wallet(db, current_user.user_id)

    txn = ShopWalletTransaction(
        wallet_id=wallet.wallet_id,
        shop_id=current_user.user_id,
        amount=amount,
        txn_type="deposit_pending",
        ref_type="mock_deposit",
        note=body.get("note") or "Nạp tiền (demo)",
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)

    expires_at = txn.created_at + timedelta(seconds=WALLET_DEPOSIT_TTL_SECONDS)
    return {
        "txn_id": txn.txn_id,
        "amount": float(amount),
        "status": "pending",
        "expires_at": expires_at.isoformat(),
    }


@router.get("/deposit/status/{txn_id}")
def get_deposit_status(
    txn_id: int,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    txn = _owned_txn_or_404(db, txn_id, current_user)
    expires_at = txn.created_at + timedelta(seconds=WALLET_DEPOSIT_TTL_SECONDS)
    if txn.txn_type == "deposit_pending" and datetime.utcnow() >= expires_at:
        txn.txn_type = "deposit_rejected"
        txn.note = "Hết hạn (demo)"
        db.commit()
    return {
        "txn_id": txn.txn_id,
        "status": _deposit_status(txn),
        "amount": float(txn.amount),
        "expires_at": expires_at.isoformat(),
    }


@router.post("/deposit/confirm/{txn_id}")
def confirm_deposit(
    txn_id: int,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    """Nút 'Xác nhận thanh toán' ở trang simulator — giả lập thanh toán thành
    công, cộng thẳng vào balance. Không có cổng thanh toán thật, không qua
    admin duyệt — đúng tinh thần hệ thống demo."""
    txn = _owned_txn_or_404(db, txn_id, current_user)
    expires_at = txn.created_at + timedelta(seconds=WALLET_DEPOSIT_TTL_SECONDS)
    if datetime.utcnow() >= expires_at:
        if txn.txn_type == "deposit_pending":
            txn.txn_type = "deposit_rejected"
            txn.note = "Hết hạn (demo)"
            db.commit()
        raise HTTPException(status_code=400, detail="Phiên nạp tiền đã hết hạn")
    if txn.txn_type != "deposit_pending":
        raise HTTPException(status_code=400, detail=f"Giao dịch đã ở trạng thái '{_deposit_status(txn)}', không thể xác nhận lại")

    wallet = db.query(ShopWallet).filter(ShopWallet.wallet_id == txn.wallet_id).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet không tồn tại")

    wallet.balance = Decimal(str(wallet.balance)) + Decimal(str(txn.amount))
    txn.txn_type = "deposit"
    db.commit()

    return {
        "status": "success",
        "txn_id": txn.txn_id,
        "amount": float(txn.amount),
        "new_balance": float(wallet.balance),
    }


@router.post("/deposit/regenerate/{txn_id}")
def regenerate_deposit(
    txn_id: int,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    """Nút 'Tạo lại mã' khi phiên nạp đã hết hạn — reset lại mốc thời gian
    trên cùng 1 giao dịch (không tạo dòng mới)."""
    txn = _owned_txn_or_404(db, txn_id, current_user)
    if txn.txn_type == "deposit":
        raise HTTPException(status_code=400, detail="Giao dịch đã nạp thành công, không thể tạo lại")

    txn.txn_type = "deposit_pending"
    txn.note = "Nạp tiền (demo) — tạo lại"
    txn.created_at = datetime.utcnow()
    db.commit()
    db.refresh(txn)

    expires_at = txn.created_at + timedelta(seconds=WALLET_DEPOSIT_TTL_SECONDS)
    return {
        "txn_id": txn.txn_id,
        "amount": float(txn.amount),
        "status": "pending",
        "expires_at": expires_at.isoformat(),
    }


# ── Shop: chuyển sang "Tiền đấu giá" — tức thời, tự động, không qua admin ───

@router.post("/allocate-auction")
def allocate_auction(
    body: dict,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    """Chuyển 1 phần Số dư khả dụng sang nhãn 'Tiền đấu giá' — CHỈ là đánh dấu
    hiển thị/ghi chú cho shop tự quản lý, KHÔNG khoá tiền khỏi việc đặt giá
    (place_bid vẫn luôn dùng balance - reserved như cũ, không đọc auction_fund).
    Hành động tức thời, hệ thống tự nhận ngay, không cần admin duyệt."""
    amount = Decimal(str(body.get("amount", 0)))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Số tiền phải lớn hơn 0")

    wallet = _get_or_create_wallet(db, current_user.user_id)
    if amount > Decimal(str(wallet.available)):
        raise HTTPException(status_code=400, detail="Số dư khả dụng không đủ")

    wallet.auction_fund = Decimal(str(wallet.auction_fund)) + amount

    txn = ShopWalletTransaction(
        wallet_id=wallet.wallet_id,
        shop_id=current_user.user_id,
        amount=amount,
        txn_type="allocate_auction",
        ref_type="manual",
        note=body.get("note") or "Chuyển vào Tiền đấu giá",
    )
    db.add(txn)
    db.commit()

    return {
        "message": "Đã chuyển vào Tiền đấu giá",
        **_fmt_wallet(wallet),
    }


# ── Admin: xem tổng ví (chỉ xem, không thao tác) ────────────────────────────

@router.get("/admin/wallets")
def admin_list_wallets(
    page:  int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Chỉ Superadmin xem được tổng số dư ví của từng shop. Nạp tiền giờ tự
    động 100% (shop tự thao tác, không qua duyệt) nên admin không còn hàng
    chờ duyệt nào để xử lý — trang này thuần túy để theo dõi/đối soát."""
    query = db.query(ShopWallet).order_by(ShopWallet.balance.desc())
    items, total, pages = paginate(query, page, limit)
    result = []
    for w in items:
        shop = db.query(Shop).filter(Shop.shop_id == w.shop_id).first()
        result.append({
            **_fmt_wallet(w),
            "shop_name": shop.shop_name if shop else str(w.shop_id),
        })
    return {"wallets": result, "total": total, "pages": pages}
