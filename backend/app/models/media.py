from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from app.database import Base


class MediaAsset(Base):
    """Đăng ký TẬP TRUNG mọi ảnh upload trong hệ thống — sản phẩm, banner,
    shop, avatar user... bất kể tính năng nào tạo ra nó, đều đi qua chung
    save_upload_file() và được ghi vào đây với 1 mã (code) riêng.

    Đây là nguyên tắc: ảnh upload lên chỉ được hệ thống chấp nhận là hợp lệ
    khi nó có mặt ở bảng này (tức super có thể thấy được) — super là nơi
    nhìn thấy toàn bộ dữ liệu ảnh của cả hệ thống, giống người cha biết hết
    mọi thứ của các con (từng module: shop/product/banner/user).
    """
    __tablename__ = "media_assets"

    media_id           = Column(Integer, primary_key=True, autoincrement=True)
    code                = Column(String(40), nullable=False, unique=True, index=True)
    url                 = Column(String(500), nullable=False)
    # subfolder: products | banners | shops | users | shop_registrations ...
    subfolder           = Column(String(50), nullable=False, index=True)
    original_filename   = Column(String(255))
    content_type        = Column(String(100))
    size_bytes           = Column(Integer)
    uploaded_by           = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at             = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_media_subfolder_created", "subfolder", "created_at"),
    )
