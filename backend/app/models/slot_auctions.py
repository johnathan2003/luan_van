"""
app/models/slot_auctions.py
------------------------------
Đấu giá "vị trí gắn sản phẩm" — 2 hệ riêng biệt, cùng kiến trúc:
  - Flash slot  → thắng thì sản phẩm lên khu Flash Sale trang chủ.
  - Top slot    → thắng thì sản phẩm được "boost" (product_boosts) khi tìm
                  kiếm / duyệt danh mục / sản phẩm liên quan.

Khác biệt với banner_auctions (app/models/wallet_auction.py):
  - Nội dung thắng là 1 SẢN PHẨM có sẵn (product_id), không phải ảnh tự do.
  - Không có bước duyệt trước khi bid — admin chỉ công bố quy định ảnh/nội
    dung trước phiên, ai đủ tiền cũng bid được. Chỉ người THẮNG mới cần nộp
    nội dung + được duyệt (sau khi thắng), y hệt banner.
  - Kết phiên có 2 nhánh trả tiền: mua đứt (chạm end_price → trừ 100% ngay)
    hoặc thắng thường (trừ 20% ngay, 30 phút trả nốt 80%, trễ = 1 vi phạm,
    3 vi phạm = khoá đấu giá, 20% mất hẳn nếu không trả kịp, slot bỏ trống).
  - Nội dung duyệt xong không lên ngay — chờ tới 0:00 hôm sau mới public
    đồng loạt (activates_at), tự kích hoạt lúc có người đọc (không cần job
    nền riêng).
"""
from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean,
    DateTime, Text, ForeignKey, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


# ── Flash slot ────────────────────────────────────────────────────────────────

class FlashSlot(Base):
    """Vị trí đấu giá Flash Sale — admin tạo sẵn."""
    __tablename__ = "flash_slots"

    slot_id            = Column(Integer, primary_key=True, autoincrement=True)
    name                = Column(String(200), nullable=False)
    base_price          = Column(Numeric(15, 2), nullable=False, default=0)
    is_active            = Column(Boolean, default=True)
    # Quy định ảnh/nội dung GỐC của slot — phiên có thể ghi đè riêng
    image_width         = Column(Integer)
    image_height        = Column(Integer)
    image_format         = Column(String(100))   # vd "jpg,png,webp"
    content_rules         = Column(Text)          # mô tả yêu cầu / danh sách cấm
    current_auction_id    = Column(Integer, ForeignKey("flash_slot_auctions.auction_id", use_alter=True, name="fk_flash_slot_current_auction"), nullable=True)
    created_at             = Column(DateTime, server_default=func.now())

    current_auction = relationship("FlashSlotAuction", foreign_keys=[current_auction_id], post_update=True)
    auctions        = relationship("FlashSlotAuction", foreign_keys="[FlashSlotAuction.slot_id]", back_populates="slot")


class FlashSlotAuction(Base):
    """1 phiên đấu giá cho 1 flash slot."""
    __tablename__ = "flash_slot_auctions"

    auction_id     = Column(Integer, primary_key=True, autoincrement=True)
    slot_id        = Column(Integer, ForeignKey("flash_slots.slot_id", ondelete="CASCADE"), nullable=False, index=True)

    announced_at   = Column(DateTime, server_default=func.now())   # lúc admin tạo — phải cách start_time >= 1 ngày (check ở service)
    start_time     = Column(DateTime, nullable=False)
    end_time       = Column(DateTime, nullable=False)

    # Quy định riêng cho phiên — NULL thì dùng của slot
    image_width    = Column(Integer)
    image_height   = Column(Integer)
    image_format   = Column(String(100))
    content_rules  = Column(Text)

    start_price      = Column(Numeric(15, 2), nullable=False, default=0)
    current_price    = Column(Numeric(15, 2), nullable=False, default=0)
    end_price        = Column(Numeric(15, 2), nullable=False)
    end_price_hits   = Column(Integer, nullable=False, default=0)

    # status: upcoming | active | ended | live | forfeited | cancelled
    status         = Column(String(20), nullable=False, default="upcoming", index=True)

    winner_shop_id     = Column(Integer, ForeignKey("shops.shop_id", ondelete="SET NULL"), nullable=True)
    winner_bid_id       = Column(Integer, ForeignKey("flash_slot_bids.bid_id", use_alter=True, name="fk_flash_auction_winner_bid"), nullable=True)
    winner_product_id   = Column(Integer, ForeignKey("products.product_id", ondelete="SET NULL"), nullable=True)
    win_type              = Column(String(20), nullable=True)   # 'buyout' | 'bid'

    deposit_amount        = Column(Numeric(15, 2))
    deposit_charged_at     = Column(DateTime)
    payment_deadline         = Column(DateTime)
    final_paid_at             = Column(DateTime)

    display_duration_days     = Column(Integer, nullable=False, default=2)
    display_until               = Column(DateTime)

    # Nội dung nộp sau khi thắng (giống banner_auctions)
    submission_image_url        = Column(String(500))
    submission_title              = Column(String(255))
    submission_link                = Column(String(500))
    submission_status                = Column(String(20))   # pending | approved | rejected
    submission_attempts              = Column(Integer, nullable=False, default=0)   # số lần đã nộp — chỉ giới hạn 3 lần với win_type='buyout'
    submitted_at                      = Column(DateTime)
    review_deadline                     = Column(DateTime)   # submitted_at + 6h
    reviewed_at                           = Column(DateTime)
    reject_reason                           = Column(Text)

    activates_at                              = Column(DateTime)   # mốc 0:00 sẽ public

    created_at                                  = Column(DateTime, server_default=func.now())

    slot           = relationship("FlashSlot", foreign_keys=[slot_id], back_populates="auctions")
    winner_shop    = relationship("Shop", foreign_keys=[winner_shop_id])
    winner_bid     = relationship("FlashSlotBid", foreign_keys=[winner_bid_id], post_update=True)
    winner_product = relationship("Product", foreign_keys=[winner_product_id])
    bids           = relationship("FlashSlotBid", foreign_keys="[FlashSlotBid.auction_id]", back_populates="auction", cascade="all, delete-orphan")


class FlashSlotBid(Base):
    """Một lần đặt giá trong phiên flash slot. product_id chọn 1 lần trước
    lần bid đầu tiên của shop trong phiên — các bid sau của cùng shop phải
    trùng product_id này (check ở service, không enforce ở DB)."""
    __tablename__ = "flash_slot_bids"

    bid_id     = Column(Integer, primary_key=True, autoincrement=True)
    auction_id = Column(Integer, ForeignKey("flash_slot_auctions.auction_id", ondelete="CASCADE"), nullable=False, index=True)
    shop_id    = Column(Integer, ForeignKey("shops.shop_id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id", ondelete="SET NULL"), nullable=True)
    amount     = Column(Numeric(15, 2), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    auction = relationship("FlashSlotAuction", foreign_keys=[auction_id], back_populates="bids")
    shop    = relationship("Shop", foreign_keys=[shop_id])
    product = relationship("Product", foreign_keys=[product_id])


# ── Top slot ─────────────────────────────────────────────────────────────────
# Cấu trúc giống hệt Flash slot — tách bảng riêng theo yêu cầu, KHÔNG dùng
# chung với flash (dễ chỉnh sửa độc lập sau này).

class TopSlot(Base):
    """Vị trí đấu giá 'Top sản phẩm' — thắng thì được boost tìm kiếm/danh mục."""
    __tablename__ = "top_slots"

    slot_id            = Column(Integer, primary_key=True, autoincrement=True)
    name                = Column(String(200), nullable=False)
    base_price          = Column(Numeric(15, 2), nullable=False, default=0)
    is_active            = Column(Boolean, default=True)
    image_width         = Column(Integer)
    image_height        = Column(Integer)
    image_format         = Column(String(100))
    content_rules         = Column(Text)
    current_auction_id    = Column(Integer, ForeignKey("top_slot_auctions.auction_id", use_alter=True, name="fk_top_slot_current_auction"), nullable=True)
    created_at             = Column(DateTime, server_default=func.now())

    current_auction = relationship("TopSlotAuction", foreign_keys=[current_auction_id], post_update=True)
    auctions        = relationship("TopSlotAuction", foreign_keys="[TopSlotAuction.slot_id]", back_populates="slot")


class TopSlotAuction(Base):
    """1 phiên đấu giá cho 1 top slot. KHÔNG có mua đứt (endPrice luôn NULL)
    — chỉ đấu giá thường: thắng thì cọc 20% + tất toán 80% sau 30 phút."""
    __tablename__ = "top_slot_auctions"

    auction_id     = Column(Integer, primary_key=True, autoincrement=True)
    slot_id        = Column(Integer, ForeignKey("top_slots.slot_id", ondelete="CASCADE"), nullable=False, index=True)

    announced_at   = Column(DateTime, server_default=func.now())
    start_time     = Column(DateTime, nullable=False)
    end_time       = Column(DateTime, nullable=False)

    image_width    = Column(Integer)
    image_height   = Column(Integer)
    image_format   = Column(String(100))
    content_rules  = Column(Text)

    start_price      = Column(Numeric(15, 2), nullable=False, default=0)
    current_price    = Column(Numeric(15, 2), nullable=False, default=0)
    # Top slot KHÔNG có mua đứt (khác Flash) — end_price luôn NULL, giữ cột
    # lại cho đồng nhất schema với flash_slot_auctions nhưng service layer
    # (place_bid/settle_auction) tự bỏ qua nhánh buyout khi giá trị là None.
    end_price        = Column(Numeric(15, 2), nullable=True)
    end_price_hits   = Column(Integer, nullable=False, default=0)

    status         = Column(String(20), nullable=False, default="upcoming", index=True)

    winner_shop_id     = Column(Integer, ForeignKey("shops.shop_id", ondelete="SET NULL"), nullable=True)
    winner_bid_id       = Column(Integer, ForeignKey("top_slot_bids.bid_id", use_alter=True, name="fk_top_auction_winner_bid"), nullable=True)
    winner_product_id   = Column(Integer, ForeignKey("products.product_id", ondelete="SET NULL"), nullable=True)
    win_type              = Column(String(20), nullable=True)

    deposit_amount        = Column(Numeric(15, 2))
    deposit_charged_at     = Column(DateTime)
    payment_deadline         = Column(DateTime)
    final_paid_at             = Column(DateTime)

    display_duration_days     = Column(Integer, nullable=False, default=2)
    display_until               = Column(DateTime)

    submission_image_url        = Column(String(500))
    submission_title              = Column(String(255))
    submission_link                = Column(String(500))
    submission_status                = Column(String(20))
    submission_attempts              = Column(Integer, nullable=False, default=0)   # số lần đã nộp — chỉ giới hạn 3 lần với win_type='buyout'
    submitted_at                      = Column(DateTime)
    review_deadline                     = Column(DateTime)
    reviewed_at                           = Column(DateTime)
    reject_reason                           = Column(Text)

    activates_at                              = Column(DateTime)

    created_at                                  = Column(DateTime, server_default=func.now())

    slot           = relationship("TopSlot", foreign_keys=[slot_id], back_populates="auctions")
    winner_shop    = relationship("Shop", foreign_keys=[winner_shop_id])
    winner_bid     = relationship("TopSlotBid", foreign_keys=[winner_bid_id], post_update=True)
    winner_product = relationship("Product", foreign_keys=[winner_product_id])
    bids           = relationship("TopSlotBid", foreign_keys="[TopSlotBid.auction_id]", back_populates="auction", cascade="all, delete-orphan")


class TopSlotBid(Base):
    """Một lần đặt giá trong phiên top slot. product_id chọn 1 lần trước lần
    bid đầu tiên của shop trong phiên — các bid sau của cùng shop phải trùng
    product_id này (check ở service, không enforce ở DB)."""
    __tablename__ = "top_slot_bids"

    bid_id     = Column(Integer, primary_key=True, autoincrement=True)
    auction_id = Column(Integer, ForeignKey("top_slot_auctions.auction_id", ondelete="CASCADE"), nullable=False, index=True)
    shop_id    = Column(Integer, ForeignKey("shops.shop_id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id", ondelete="SET NULL"), nullable=True)
    amount     = Column(Numeric(15, 2), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    auction = relationship("TopSlotAuction", foreign_keys=[auction_id], back_populates="bids")
    shop    = relationship("Shop", foreign_keys=[shop_id])
    product = relationship("Product", foreign_keys=[product_id])


# ── Vi phạm đấu giá — dùng chung cho cả flash + top ───────────────────────────

class ShopBidViolation(Base):
    """Đếm dồn vi phạm 'thắng nhưng không trả nốt 80% trong 30 phút', cộng dồn
    qua cả flash_slot_auctions và top_slot_auctions. Đủ 3 -> banned=True,
    chặn bid ở cả 2 hệ."""
    __tablename__ = "shop_bid_violations"

    shop_id          = Column(Integer, ForeignKey("shops.shop_id", ondelete="CASCADE"), primary_key=True)
    violation_count  = Column(Integer, nullable=False, default=0)
    banned           = Column(Boolean, nullable=False, default=False)
    updated_at       = Column(DateTime, server_default=func.now(), onupdate=func.now())

    shop = relationship("Shop", foreign_keys=[shop_id])


# ── Tag sản phẩm + boost (dùng cho top slot, và tìm kiếm nói chung) ───────────

class ProductTag(Base):
    """Kho tag dùng chung toàn hệ thống."""
    __tablename__ = "product_tags"

    tag_id     = Column(Integer, primary_key=True, autoincrement=True)
    tag_name   = Column(String(100), nullable=False, unique=True, index=True)
    created_at = Column(DateTime, server_default=func.now())


class ProductTagMap(Base):
    """Gắn tag cho sản phẩm — tự sinh khi tạo/sửa sản phẩm (từ category + tên),
    KHÔNG chỉ dành riêng cho sản phẩm thắng Top."""
    __tablename__ = "product_tag_map"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.product_id", ondelete="CASCADE"), nullable=False, index=True)
    tag_id     = Column(Integer, ForeignKey("product_tags.tag_id", ondelete="CASCADE"), nullable=False, index=True)

    __table_args__ = (
        UniqueConstraint("product_id", "tag_id", name="uq_product_tag"),
    )

    product = relationship("Product", foreign_keys=[product_id])
    tag     = relationship("ProductTag", foreign_keys=[tag_id])


class ProductBoost(Base):
    """Sản phẩm đang được ưu tiên hiển thị — sinh ra khi 1 top_slot_auctions
    chuyển status='live'. Search/danh mục/liên quan JOIN bảng này, lọc
    expires_at > now() để biết sản phẩm nào đang được boost."""
    __tablename__ = "product_boosts"

    boost_id          = Column(Integer, primary_key=True, autoincrement=True)
    product_id        = Column(Integer, ForeignKey("products.product_id", ondelete="CASCADE"), nullable=False, index=True)
    source_auction_id = Column(Integer, ForeignKey("top_slot_auctions.auction_id", ondelete="SET NULL"), nullable=True)
    expires_at         = Column(DateTime, nullable=False, index=True)
    created_at           = Column(DateTime, server_default=func.now())

    product = relationship("Product", foreign_keys=[product_id])
