"""
app/routes/wallet.py
---------------------
Shop wallet API + Admin deposit approval.

Shop endpoints (require shop role):
  GET  /api/v1/wallet/me                      — số dư + reserved + available
  GET  /api/v1/wallet/transactions            — lịch sử giao dịch
  POST /api/v1/wallet/deposit-request         — "Nạp thử" — tạo pending deposit

Admin endpoints (require admin/superadmin):
  GET  /api/v1/wallet/admin/deposit-requests  — danh sách chờ duyệt
  POST /api/v1/wallet/admin/deposit-requests/{id}/approve
  POST /api/v1/wallet/admin/deposit-requests/{id}/reject
"""
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user, require_shop_owner, require_admin_or_superadmin, require_superadmin
from app.models.user import User, Role, UserRole
from app.models.wallet_auction import ShopWallet, ShopWalletTransaction
from app.models.shop import Shop
from app.utils.helpers import paginate
from app.services.notification_service import create_notification

# ref_type của các giao dịch nạp tiền THẬT SỰ cần admin duyệt (không tính tiền
# doanh thu đơn hàng tự động cộng vào ví — payout_service.py cũng dùng
# txn_type="deposit" cho doanh thu, nhưng ref_type="order_completed" nên phải
# lọc riêng để không lẫn vào hàng chờ duyệt nạp tiền thủ công).
MANUAL_DEPOSIT_REF_TYPES = ["manual", "mock_deposit"]


def _notify_admins_new_deposit(db: Session, shop_name: str, amount: Decimal, txn_id: int):
    """Báo cho toàn bộ admin/superadmin đang active khi có shop nộp yêu cầu nạp tiền."""
    admin_ids = db.query(User.user_id).join(UserRole, UserRole.user_id == User.user_id).join(
        Role, Role.role_id == UserRole.role_id
    ).filter(
        Role.role_name.in_(["admin", "superadmin"]),
        UserRole.status == "active",
        User.status == "active",
    ).distinct().all()
    for (uid,) in admin_ids:
        create_notification(
            db, user_id=uid,
            title="💰 Yêu cầu nạp tiền mới",
            message=f"Shop {shop_name} vừa gửi yêu cầu nạp {float(amount):,.0f}đ vào ví — chờ duyệt.",
            notif_type="wallet_deposit",
            related_entity_type="wallet_txn",
            related_entity_id=txn_id,
            action_url="/admin/wallet",
        )

router = APIRouter(prefix="/api/v1/wallet", tags=["Wallet"])

# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_create_wallet(db: Session, shop_id: int) -> ShopWallet:
    wallet = db.query(ShopWallet).filter(ShopWallet.shop_id == shop_id).first()
    if not wallet:
        wallet = ShopWallet(shop_id=shop_id, balance=Decimal("0"), reserved=Decimal("0"))
        db.add(wallet)
        db.flush()
    return wallet


def _fmt_wallet(w: ShopWallet) -> dict:
    balance  = float(w.balance)
    reserved = float(w.reserved)
    return {
        "wallet_id": w.wallet_id,
        "shop_id":   w.shop_id,
        "balance":   balance,
        "reserved":  reserved,
        "available": round(balance - reserved, 2),
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


# ── Shop: "Nạp thử" (mock deposit) ──────────────────────────────────────────

@router.post("/deposit-request")
def request_deposit(
    body: dict,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    """
    Tạo yêu cầu nạp tiền mock.
    Admin phê duyệt → tiền vào ví.
    Trong seed/dev, admin có thể tự-approve ngay.
    """
    amount = Decimal(str(body.get("amount", 0)))
    note   = body.get("note", "Nạp thử")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Số tiền phải lớn hơn 0")
    if amount > 100_000_000:
        raise HTTPException(status_code=400, detail="Tối đa 100,000,000đ mỗi lần nạp")

    # Kiểm tra không có request pending quá 2
    pending = db.query(ShopWalletTransaction).filter(
        ShopWalletTransaction.shop_id == current_user.user_id,
        ShopWalletTransaction.txn_type == "deposit_pending",
    ).count()
    if pending >= 2:
        raise HTTPException(status_code=400, detail="Bạn đang có 2 yêu cầu nạp chờ duyệt — hãy chờ admin xử lý")

    wallet = _get_or_create_wallet(db, current_user.user_id)

    txn = ShopWalletTransaction(
        wallet_id=wallet.wallet_id,
        shop_id=current_user.user_id,
        amount=amount,
        txn_type="deposit_pending",
        ref_type="mock_deposit",
        note=note,
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)

    shop = db.query(Shop).filter(Shop.shop_id == current_user.user_id).first()
    _notify_admins_new_deposit(db, shop.shop_name if shop else f"#{current_user.user_id}", amount, txn.txn_id)

    return {
        "message": "Yêu cầu nạp tiền đã gửi — admin sẽ phê duyệt sớm",
        "txn_id": txn.txn_id,
        "amount": float(amount),
        "status": "pending",
    }


# ── Admin: duyệt / từ chối deposit ──────────────────────────────────────────

@router.get("/admin/deposit-requests")
def list_deposit_requests(
    page:   int = Query(1, ge=1),
    limit:  int = Query(20, ge=1, le=100),
    status: str = Query("pending", regex="^(pending|all)$"),
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    query = db.query(ShopWalletTransaction).filter(
        ShopWalletTransaction.txn_type.in_(["deposit_pending", "deposit", "deposit_rejected"]),
        ShopWalletTransaction.ref_type.in_(MANUAL_DEPOSIT_REF_TYPES),
    )
    if status == "pending":
        query = query.filter(ShopWalletTransaction.txn_type == "deposit_pending")
    query = query.order_by(ShopWalletTransaction.created_at.desc())
    items, total, pages = paginate(query, page, limit)

    result = []
    for t in items:
        shop = db.query(Shop).filter(Shop.shop_id == t.shop_id).first()
        result.append({
            **_fmt_txn(t),
            "shop_name": shop.shop_name if shop else str(t.shop_id),
        })
    return {"deposits": result, "total": total, "pages": pages}


@router.post("/admin/deposit-requests/{txn_id}/approve")
def approve_deposit(
    txn_id: int,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    txn = db.query(ShopWalletTransaction).filter(
        ShopWalletTransaction.txn_id == txn_id,
        ShopWalletTransaction.txn_type == "deposit_pending",
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu pending")

    # Cộng tiền vào ví
    wallet = db.query(ShopWallet).filter(ShopWallet.wallet_id == txn.wallet_id).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet không tồn tại")

    wallet.balance = Decimal(str(wallet.balance)) + Decimal(str(txn.amount))
    txn.txn_type = "deposit"
    txn.note = (txn.note or "") + f" [Duyệt bởi admin #{current_user.user_id}]"

    db.commit()

    create_notification(
        db, user_id=txn.shop_id,
        title="✅ Yêu cầu nạp tiền đã được duyệt",
        message=f"Yêu cầu nạp {float(txn.amount):,.0f}đ đã được duyệt — tiền đã vào ví.",
        notif_type="wallet_deposit_approved",
        related_entity_type="wallet_txn",
        related_entity_id=txn.txn_id,
        action_url="/shop/wallet",
    )

    return {
        "message": "Đã phê duyệt — tiền đã vào ví shop",
        "txn_id":  txn_id,
        "amount":  float(txn.amount),
        "new_balance": float(wallet.balance),
    }


@router.get("/admin/wallets")
def admin_list_wallets(
    page:  int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Chỉ Superadmin xem được tổng số dư ví của từng shop.
    Admin thường chỉ thấy hàng chờ duyệt nạp tiền (từng lần nạp), không thấy tổng ví."""
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


@router.post("/admin/deposit-requests/{txn_id}/reject")
def reject_deposit(
    txn_id: int,
    body: dict,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    txn = db.query(ShopWalletTransaction).filter(
        ShopWalletTransaction.txn_id == txn_id,
        ShopWalletTransaction.txn_type == "deposit_pending",
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu pending")

    reason = body.get("reason", "Admin từ chối")
    txn.txn_type = "deposit_rejected"
    txn.note = f"Từ chối: {reason}"
    db.commit()

    create_notification(
        db, user_id=txn.shop_id,
        title="❌ Yêu cầu nạp tiền bị từ chối",
        message=f"Yêu cầu nạp {float(txn.amount):,.0f}đ đã bị từ chối. Lý do: {reason}",
        notif_type="wallet_deposit_rejected",
        related_entity_type="wallet_txn",
        related_entity_id=txn.txn_id,
        action_url="/shop/wallet",
    )

    return {"message": "Đã từ chối yêu cầu nạp tiền", "txn_id": txn_id}
