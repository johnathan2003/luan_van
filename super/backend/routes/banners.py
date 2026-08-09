"""
super/backend/routes/banners.py
---------------------------------
Superadmin — duyệt banner shop nộp sau khi thắng đấu giá.

QUAN TRỌNG: endpoint /live ở dưới gọi thẳng app.routes.banners.get_live_banners()
— hàm DUY NHẤT tính "banner nào đang thật sự hiển thị trên site", cũng chính
là hàm mà GET /api/v1/banners/live (Home.tsx trang chủ) dùng. Không viết lại
logic riêng ở đây — đảm bảo những gì superadmin thấy ở tab "Đang hoạt động"
LUÔN khớp 100% với những gì khách hàng thấy trên trang chủ.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.wallet_auction import BannerAuction, BannerSlot
from app.routes.banners import _fmt_auction, get_live_banners
from super.middleware import require_super

router = APIRouter()


class RejectBody(BaseModel):
    reason: Optional[str] = None


@router.get("/pending")
def list_pending_banners(
    _:  dict    = Depends(require_super),
    db: Session = Depends(get_db),
):
    """Banner shop đã nộp, đang chờ duyệt (banner_status='pending')."""
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


@router.post("/{auction_id}/approve")
def approve_banner(
    auction_id: int,
    _:  dict    = Depends(require_super),
    db: Session = Depends(get_db),
):
    a = db.query(BannerAuction).filter(BannerAuction.auction_id == auction_id).first()
    if not a:
        raise HTTPException(404, "Không tìm thấy phiên đấu giá")
    if a.banner_status != "pending":
        raise HTTPException(400, f"Banner đang ở trạng thái '{a.banner_status}', không thể duyệt")
    a.banner_status = "approved"
    a.banner_reviewed_at = datetime.now()
    a.banner_reject_reason = None
    db.commit()
    return {"message": "Đã duyệt — banner sẽ hiển thị trên trang chủ ngay", **_fmt_auction(a)}


@router.post("/{auction_id}/reject")
def reject_banner(
    auction_id: int,
    body: RejectBody,
    _:    dict    = Depends(require_super),
    db:   Session = Depends(get_db),
):
    a = db.query(BannerAuction).filter(BannerAuction.auction_id == auction_id).first()
    if not a:
        raise HTTPException(404, "Không tìm thấy phiên đấu giá")
    if a.banner_status != "pending":
        raise HTTPException(400, f"Banner đang ở trạng thái '{a.banner_status}', không thể từ chối")
    a.banner_status = "rejected"
    a.banner_reviewed_at = datetime.now()
    a.banner_reject_reason = body.reason or "Không đạt yêu cầu"
    db.commit()
    return {"message": "Đã từ chối — shop có thể nộp lại ảnh khác", **_fmt_auction(a)}
