"""
super/backend/routes/banners.py
---------------------------------
Superadmin — CHỈ XEM đấu giá banner (pending/live/history). Duyệt/từ chối
nội dung banner sau đấu giá đã CHUYỂN SANG ADMIN (app/routes/banners.py —
POST /api/v1/banners/auctions/{id}/approve|reject), đồng bộ với cách
slot_auctions hoạt động: admin vận hành, super chỉ quan sát.

Ngoại lệ: 4 endpoint /manage* (CRUD trực tiếp bảng "banners" chính thức, vd
thêm banner khuyến mãi thủ công không qua đấu giá) VẪN thuộc quyền super —
đây là năng lực quản lý nội dung tổng thể, tách biệt khỏi luồng đấu giá.

QUAN TRỌNG: endpoint /live ở dưới gọi thẳng app.routes.banners.get_live_banners()
— hàm DUY NHẤT tính "banner nào đang thật sự hiển thị trên site", cũng chính
là hàm mà GET /api/v1/banners/live (Home.tsx trang chủ) dùng. Không viết lại
logic riêng ở đây — đảm bảo những gì superadmin thấy ở tab "Đang hoạt động"
LUÔN khớp 100% với những gì khách hàng thấy trên trang chủ.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.wallet_auction import BannerAuction, BannerSlot, Banner
from app.routes.banners import _fmt_auction, get_live_banners
from super.middleware import require_super

router = APIRouter()


class BannerCreate(BaseModel):
    slot_id:   int
    image_url: str
    title:     Optional[str] = None
    link:      Optional[str] = None
    shop_id:   Optional[int] = None
    shop_name: Optional[str] = None
    status:    str = "active"


class BannerPatch(BaseModel):
    slot_id:   Optional[int] = None
    image_url: Optional[str] = None
    title:     Optional[str] = None
    link:      Optional[str] = None
    shop_id:   Optional[int] = None
    shop_name: Optional[str] = None
    status:    Optional[str] = None


def _fmt_banner(b: Banner) -> dict:
    return {
        "banner_id":         b.banner_id,
        "slot_id":           b.slot_id,
        "slot_name":         b.slot.name if b.slot else None,
        "position":          b.slot.position if b.slot else b.position,
        "image_url":         b.image_url,
        "title":             b.title,
        "link":              b.link,
        "shop_id":           b.shop_id,
        "shop_name":         b.shop_name,
        "source_auction_id": b.source_auction_id,
        "status":            b.status,
        "created_at":        b.created_at.isoformat() if b.created_at else None,
        "updated_at":        b.updated_at.isoformat() if b.updated_at else None,
    }


@router.get("/pending")
def list_pending_banners(
    _:  dict    = Depends(require_super),
    db: Session = Depends(get_db),
):
    """Banner shop đã nộp, đang chờ ADMIN duyệt (banner_status='pending') —
    CHỈ XEM, việc duyệt/từ chối thật sự nằm ở app/routes/banners.py
    (POST /api/v1/banners/auctions/{id}/approve|reject)."""
    auctions = (
        db.query(BannerAuction)
        .filter(BannerAuction.banner_status == "pending")
        .order_by(BannerAuction.banner_submitted_at.desc())
        .all()
    )
    return {"banners": [_fmt_auction(a) for a in auctions]}


@router.get("/live")
def list_live_banners(
    position: Optional[str] = None,
    _:        dict          = Depends(require_super),
    db:       Session       = Depends(get_db),
):
    """Banner ĐANG THẬT SỰ hiển thị trên site — dùng chung 100% logic với
    GET /api/v1/banners/live (trang chủ). Nếu 1 banner hiện ở đây thì chắc
    chắn nó cũng đang hiện trên trang chủ, và ngược lại."""
    return {"banners": get_live_banners(db, position)}


@router.get("/history")
def list_banner_history(
    _:  dict    = Depends(require_super),
    db: Session = Depends(get_db),
):
    """Toàn bộ auction đã có nộp banner (mọi trạng thái duyệt) — để xem lịch sử."""
    auctions = (
        db.query(BannerAuction)
        .filter(BannerAuction.banner_status.isnot(None))
        .order_by(BannerAuction.banner_submitted_at.desc())
        .limit(100)
        .all()
    )
    return {"banners": [_fmt_auction(a) for a in auctions]}


# approve/reject nội dung banner đã CHUYỂN SANG ADMIN — xem
# app/routes/banners.py: POST /api/v1/banners/auctions/{id}/approve|reject.
# Super không còn endpoint ghi/sửa nào cho luồng đấu giá banner ở đây.


# ─── Bảng "banners" chính thức — full CRUD ─────────────────────────────────
# Khác với /pending /live /history (đọc dựa trên banner_auctions), 4 endpoint
# dưới đây thao tác TRỰC TIẾP trên bảng banners — nguồn dữ liệu get_live_
# banners() dùng. Sửa/xoá/thêm ở đây ảnh hưởng NGAY tới trang chủ.

@router.get("/manage/slots")
def list_slots_for_manage(
    _:  dict    = Depends(require_super),
    db: Session = Depends(get_db),
):
    """Danh sách slot — dùng cho dropdown khi thêm/sửa banner thủ công."""
    slots = db.query(BannerSlot).order_by(BannerSlot.slot_id).all()
    return {"slots": [
        {"slot_id": s.slot_id, "name": s.name, "position": s.position} for s in slots
    ]}


@router.get("/manage")
def list_all_banners(
    _:  dict    = Depends(require_super),
    db: Session = Depends(get_db),
):
    """Toàn bộ banner trong bảng chính thức (active lẫn inactive) — để quản lý."""
    rows = db.query(Banner).order_by(Banner.updated_at.desc()).all()
    return {"banners": [_fmt_banner(b) for b in rows]}


@router.post("/manage")
def create_banner(
    data: BannerCreate,
    _:    dict    = Depends(require_super),
    db:   Session = Depends(get_db),
):
    """Thêm banner thủ công — không qua đấu giá (vd banner khuyến mãi của sàn)."""
    slot = db.query(BannerSlot).filter(BannerSlot.slot_id == data.slot_id).first()
    if not slot:
        raise HTTPException(404, "Không tìm thấy slot")
    b = Banner(
        slot_id=data.slot_id, position=slot.position, image_url=data.image_url,
        title=data.title, link=data.link, shop_id=data.shop_id, shop_name=data.shop_name,
        status=data.status,
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return {"message": "Đã thêm banner", "banner": _fmt_banner(b)}


@router.patch("/manage/{banner_id}")
def update_banner(
    banner_id: int,
    data: BannerPatch,
    _:    dict    = Depends(require_super),
    db:   Session = Depends(get_db),
):
    """Sửa banner — kể cả đổi status active/inactive (ẩn/hiện khỏi trang chủ ngay)."""
    b = db.query(Banner).filter(Banner.banner_id == banner_id).first()
    if not b:
        raise HTTPException(404, "Không tìm thấy banner")

    changes = data.model_dump(exclude_none=True)
    if "slot_id" in changes:
        slot = db.query(BannerSlot).filter(BannerSlot.slot_id == changes["slot_id"]).first()
        if not slot:
            raise HTTPException(404, "Không tìm thấy slot")
        changes["position"] = slot.position
    for field, value in changes.items():
        setattr(b, field, value)

    db.commit()
    db.refresh(b)
    return {"message": "Đã cập nhật banner", "banner": _fmt_banner(b)}


@router.delete("/manage/{banner_id}")
def delete_banner(
    banner_id: int,
    _:  dict    = Depends(require_super),
    db: Session = Depends(get_db),
):
    """Xoá cứng banner khỏi bảng chính thức — biến mất khỏi trang chủ ngay."""
    b = db.query(Banner).filter(Banner.banner_id == banner_id).first()
    if not b:
        raise HTTPException(404, "Không tìm thấy banner")
    db.delete(b)
    db.commit()
    return {"message": f"Đã xoá banner #{banner_id}"}
