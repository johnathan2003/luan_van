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
from app.middleware.auth import get_current_user, require_shop_owner, require_admin_or_superadmin
from app.models.user import User
from app.models.wallet_auction import ShopWallet, ShopWalletTransaction
from app.models.shop import Shop
from app.utils.helpers import paginate

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
        ShopWalletTransaction.txn_type.in_(["deposit_pending", "deposit"])
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
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    """Admin xem tất cả ví shop."""
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
    return {"message": "Đã từ chối yêu cầu nạp tiền", "txn_id": txn_id}
