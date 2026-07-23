"""
payout_service.py
-----------------
Xử lý phân chia doanh thu sau khi user xác nhận đã nhận hàng (confirm_received).

Luồng:
  order.confirm_received()
      └─▶ process_order_payout(db, order)
               ├─ đọc RevenueConfig hiện hành
               ├─ tạo ShipperTransaction (delivery_fee)
               ├─ cộng ShopWallet.balance + tạo ShopWalletTransaction
               └─ tạo PlatformTransaction (commission)
"""
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import Session

from app.models.order import Order
from app.models.admin_config import RevenueConfig, PlatformTransaction
from app.models.shipment import Shipment, ShipperTransaction
from app.models.wallet_auction import ShopWallet, ShopWalletTransaction


def _get_active_config(db: Session) -> RevenueConfig:
    cfg = (
        db.query(RevenueConfig)
        .filter(RevenueConfig.is_active == True)
        .order_by(RevenueConfig.changed_at.desc())
        .first()
    )
    if cfg is None:
        # fallback default nếu chưa seed config
        return RevenueConfig(
            shop_rate=Decimal("70.00"),
            admin_rate=Decimal("15.00"),
            shipper_rate=Decimal("5.00"),
            vat_rate=Decimal("10.00"),
        )
    return cfg


def _ensure_shop_wallet(db: Session, shop_id: int) -> ShopWallet:
    """Lấy hoặc tạo ví của shop."""
    wallet = db.query(ShopWallet).filter(ShopWallet.shop_id == shop_id).first()
    if not wallet:
        wallet = ShopWallet(shop_id=shop_id, balance=Decimal("0"), reserved=Decimal("0"))
        db.add(wallet)
        db.flush()
    return wallet


def process_order_payout(db: Session, order: Order) -> dict:
    """
    Phân chia doanh thu cho 1 đơn hàng vừa completed.
    Trả về dict tóm tắt số tiền từng bên nhận.

    Gọi sau: order.order_status = "completed"  (trước db.commit)
    """
    cfg = _get_active_config(db)

    product_amount = Decimal(str(order.final_price))   # tiền hàng (sau voucher)
    shipping_fee   = Decimal(str(order.shipping_fee or 0))

    shop_rate    = Decimal(str(cfg.shop_rate))    / Decimal("100")
    admin_rate   = Decimal(str(cfg.admin_rate))   / Decimal("100")
    shipper_rate = Decimal(str(cfg.shipper_rate)) / Decimal("100")

    # Phần tiền hàng chia theo tỷ lệ
    shop_revenue     = (product_amount * shop_rate).quantize(Decimal("0.01"), ROUND_HALF_UP)
    platform_revenue = (product_amount * admin_rate).quantize(Decimal("0.01"), ROUND_HALF_UP)

    # Phí giao hàng thuộc về shipper (phần cố định từ size tier + tỷ lệ)
    shipper_delivery = (product_amount * shipper_rate + shipping_fee).quantize(
        Decimal("0.01"), ROUND_HALF_UP
    )

    # ── 1. ShipperTransaction ──────────────────────────────────────────────────
    shipment = db.query(Shipment).filter(Shipment.order_id == order.order_id).first()
    if shipment and shipment.shipper_id:
        db.add(ShipperTransaction(
            shipper_id=shipment.shipper_id,
            order_id=order.order_id,
            type="delivery_fee",
            amount=shipper_delivery,
            status="completed",
            note=f"Phí giao hàng đơn #{order.order_number}",
        ))

    # ── 2. ShopWallet ──────────────────────────────────────────────────────────
    if order.shop_id:
        wallet = _ensure_shop_wallet(db, order.shop_id)
        wallet.balance = Decimal(str(wallet.balance)) + shop_revenue
        db.add(ShopWalletTransaction(
            wallet_id=wallet.wallet_id,
            shop_id=order.shop_id,
            amount=shop_revenue,
            txn_type="deposit",
            ref_type="order_completed",
            ref_id=order.order_id,
            note=f"Doanh thu đơn #{order.order_number}",
        ))

    # ── 3. PlatformTransaction ────────────────────────────────────────────────
    db.add(PlatformTransaction(
        type="commission",
        amount=platform_revenue,
        shop_id=order.shop_id,
        order_id=order.order_id,
        status="completed",
        note=f"Hoa hồng đơn #{order.order_number} ({float(admin_rate*100):.0f}%)",
    ))

    # Không commit ở đây — để caller commit cùng order.order_status
    return {
        "shop_revenue":     float(shop_revenue),
        "shipper_delivery": float(shipper_delivery),
        "platform_revenue": float(platform_revenue),
    }
