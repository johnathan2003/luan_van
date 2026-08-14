"""
super/backend/routes/media.py
--------------------------------
Superadmin — "Thư viện ảnh": xem TOÀN BỘ ảnh đã upload trong hệ thống,
bất kể tính năng nào tạo ra (sản phẩm, banner, shop, avatar user...).
Đây là bảng media_assets — mọi upload đi qua save_upload_file() đều tự
động ghi vào đây, nên đây là nơi duy nhất super có thể "thấy" hết ảnh của
toàn hệ thống.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.media import MediaAsset
from app.models.user import User
from super.middleware import require_super

router = APIRouter()


@router.get("")
def list_media(
    subfolder: str | None = Query(None),
    q: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(40, ge=1, le=100),
    _: dict = Depends(require_super),
    db: Session = Depends(get_db),
):
    query = db.query(MediaAsset)
    if subfolder and subfolder != "all":
        query = query.filter(MediaAsset.subfolder == subfolder)
    if q:
        query = query.filter(MediaAsset.original_filename.ilike(f"%{q}%"))

    total = query.count()
    items = (
        query.order_by(MediaAsset.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    uploader_ids = {i.uploaded_by for i in items if i.uploaded_by}
    uploaders = {}
    if uploader_ids:
        for u in db.query(User).filter(User.user_id.in_(uploader_ids)).all():
            uploaders[u.user_id] = u.email

    return {
        "items": [
            {
                "media_id": i.media_id,
                "code": i.code,
                "url": i.url,
                "subfolder": i.subfolder,
                "original_filename": i.original_filename,
                "content_type": i.content_type,
                "size_bytes": i.size_bytes,
                "uploaded_by": i.uploaded_by,
                "uploaded_by_email": uploaders.get(i.uploaded_by),
                "created_at": i.created_at.isoformat() if i.created_at else None,
            }
            for i in items
        ],
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit),
    }


@router.get("/stats")
def media_stats(
    _: dict = Depends(require_super),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(MediaAsset.subfolder, func.count(MediaAsset.media_id))
        .group_by(MediaAsset.subfolder)
        .all()
    )
    total = db.query(func.count(MediaAsset.media_id)).scalar() or 0
    return {"total": total, "by_subfolder": [{"subfolder": s, "count": c} for s, c in rows]}
