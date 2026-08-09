"""
Models cho:
  - ShopWallet / ShopWalletTransaction  (ví tiền shop)
  - BannerSlot / BannerAuction / BannerBid  (đấu giá banner)
  - WarehouseTransfer / TransferPackage  (vận chuyển nội kho)
"""
from sqlalchemy import (
    Column, Integer, SmallInteger, String, Numeric, Boolean,
    DateTime, Text, ForeignKey, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


# ── Shop Wallet ──────────────────────────────────────────────────────────────

class ShopWallet(Base):
    """Ví tiền của từng shop — 1 shop : 1 wallet."""
    __tablename__ = "shop_wallet"

    wallet_id  = Column(Integer, primary_key=True, autoincrement=True)
    shop_id    = Column(Integer, ForeignKey("shops.shop_id", ondelete="CASCADE"), nullable=False, unique=True)
    balance    = Column(Numeric(15, 2), nullable=False, default=0)   # tổng số dư
    reserved   = Column(Numeric(15, 2), nullable=False, default=0)   # đang giữ cho bid
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    shop         = relationship("Shop", foreign_keys=[shop_id])
    transactions = relationship("ShopWalletTransaction", back_populates="wallet", cascade="all, delete-orphan")

    @property
    def available(self):
        """Số dư khả dụng = balance - reserved."""
        return float(self.balance) - float(self.reserved)


class ShopWalletTransaction(Base):
    """Lịch sử biến động số dư ví shop."""
    __tablename__ = "shop_wallet_transactions"

    txn_id     = Column(Integer, primary_key=True, autoincrement=True)
    wallet_id  = Column(Integer, ForeignKey("shop_wallet.wallet_id", ondelete="CASCADE"), nullable=False, index=True)
    shop_id    = Column(Integer, ForeignKey("shops.shop_id", ondelete="CASCADE"), nullable=False, index=True)
    amount     = Column(Numeric(15, 2), nullable=False)   # dương=nạp, âm=trừ
    # txn_type: deposit | withdraw | reserve | release | charge | refund
    txn_type   = Column(String(30), nullable=False)
    # ref_type: manual | mock_deposit | auction_bid | auction_win | auction_loss
    ref_type   = Column(String(50))
    ref_id     = Column(Integer)   # auction_id hoặc bid_id liên quan
    note       = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    wallet = relationship("ShopWallet", back_populates="transactions")
    shop   = relationship("Shop", foreign_keys=[shop_id])


# ── Banner Auction ────────────────────────────────────────────────────────────

class BannerSlot(Base):
    """Vị trí banner trên trang web — admin tạo sẵn."""
    __tablename__ = "banner_slots"

    slot_id            = Column(Integer, primary_key=True, autoincrement=True)
    name               = Column(String(200), nullable=False)
    position           = Column(String(50), nullable=False, default='top')  # top|middle|sidebar|category
    width              = Column(Integer)
    height             = Column(Integer)
    base_price         = Column(Numeric(15, 2), nullable=False, default=0)  # giá sàn mỗi đấu giá
    duration_days      = Column(Integer, nullable=False, default=7)          # thời hạn hiển thị
    is_active          = Column(Boolean, default=True)
    current_auction_id = Column(Integer, ForeignKey("banner_auctions.auction_id", use_alter=True, name="fk_slot_current_auction"), nullable=True)
    created_at         = Column(DateTime, server_default=func.now())

    current_auction = relationship("BannerAuction", foreign_keys=[current_auction_id], post_update=True)
    auctions        = relationship("BannerAuction", foreign_keys="[BannerAuction.slot_id]", back_populates="slot")


class BannerAuction(Base):
    """Một phiên đấu giá cho một banner slot."""
    __tablename__ = "banner_auctions"

    auction_id     = Column(Integer, primary_key=True, autoincrement=True)
    slot_id        = Column(Integer, ForeignKey("banner_slots.slot_id", ondelete="CASCADE"), nullable=False, index=True)
    start_time     = Column(DateTime, nullable=False)
    end_time       = Column(DateTime, nullable=False)
    # status: upcoming | active | ended | cancelled
    status         = Column(String(30), nullable=False, default='upcoming', index=True)
    start_price    = Column(Numeric(15, 2), nullable=False, default=0)
    current_price  = Column(Numeric(15, 2), nullable=False, default=0)
    winner_shop_id = Column(Integer, ForeignKey("shops.shop_id", ondelete="SET NULL"), nullable=True)
    winner_bid_id  = Column(Integer, ForeignKey("banner_bids.bid_id", use_alter=True, name="fk_auction_winner_bid"), nullable=True)
    created_at     = Column(DateTime, server_default=func.now())

    # ── Nội dung banner nộp sau khi thắng (shop tự upload, superadmin duyệt) ──
    banner_image_url     = Column(String(500))
    banner_title          = Column(String(255))
    banner_link            = Column(String(500))
    # banner_status: pending | approved | rejected — NULL = chưa submit gì
    banner_status           = Column(String(30))
    banner_submitted_at     = Column(DateTime)
    banner_reviewed_at      = Column(DateTime)
    banner_reject_reason    = Column(Text)

    slot         = relationship("BannerSlot", foreign_keys=[slot_id], back_populates="auctions")
    winner_shop  = relationship("Shop", foreign_keys=[winner_shop_id])
    winner_bid   = relationship("BannerBid", foreign_keys=[winner_bid_id], post_update=True)
    bids         = relationship("BannerBid", foreign_keys="[BannerBid.auction_id]", back_populates="auction", cascade="all, delete-orphan")


class BannerBid(Base):
    """Một lần đặt giá của shop trong phiên đấu giá."""
    __tablename__ = "banner_bids"

    bid_id     = Column(Integer, primary_key=True, autoincrement=True)
    auction_id = Column(Integer, ForeignKey("banner_auctions.auction_id", ondelete="CASCADE"), nullable=False, index=True)
    shop_id    = Column(Integer, ForeignKey("shops.shop_id", ondelete="CASCADE"), nullable=False, index=True)
    amount     = Column(Numeric(15, 2), nullable=False)
    # status: active | outbid | won | refunded
    status     = Column(String(30), nullable=False, default='active')
    created_at = Column(DateTime, server_default=func.now())

    auction = relationship("BannerAuction", foreign_keys=[auction_id], back_populates="bids")
    shop    = relationship("Shop", foreign_keys=[shop_id])


# ── Warehouse Transfer ────────────────────────────────────────────────────────

class WarehouseTransfer(Base):
    """Chuyến vận chuyển kiện hàng giữa các kho trong hệ thống phân cấp."""
    __tablename__ = "warehouse_transfers"

    transfer_id       = Column(Integer, primary_key=True, autoincrement=True)
    from_warehouse_id = Column(Integer, ForeignKey("warehouses.warehouse_id"), nullable=False)
    to_warehouse_id   = Column(Integer, ForeignKey("warehouses.warehouse_id"), nullable=False)
    # transfer_type: forward | return
    transfer_type     = Column(String(50), nullable=False, default='forward')
    # status: pending | in_transit | arrived | completed
    status            = Column(String(50), nullable=False, default='pending', index=True)
    note              = Column(Text)
    created_by        = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at        = Column(DateTime, server_default=func.now())
    departed_at       = Column(DateTime)
    arrived_at        = Column(DateTime)

    from_warehouse = relationship("Warehouse", foreign_keys=[from_warehouse_id])
    to_warehouse   = relationship("Warehouse", foreign_keys=[to_warehouse_id])
    creator        = relationship("User", foreign_keys=[created_by])
    packages       = relationship("TransferPackage", back_populates="transfer", cascade="all, delete-orphan")


class TransferPackage(Base):
    """Ánh xạ shipment ↔ transfer — nhiều kiện trong 1 chuyến."""
    __tablename__ = "transfer_packages"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    transfer_id = Column(Integer, ForeignKey("warehouse_transfers.transfer_id", ondelete="CASCADE"), nullable=False)
    shipment_id = Column(Integer, ForeignKey("shipments.shipment_id", ondelete="CASCADE"), nullable=False)
    added_at    = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint("transfer_id", "shipment_id", name="uq_transfer_shipment"),)

    transfer = relationship("WarehouseTransfer", back_populates="packages")
    shipment = relationship("Shipment", foreign_keys=[shipment_id])
