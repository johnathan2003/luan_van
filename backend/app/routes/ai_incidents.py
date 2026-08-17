"""
app/routes/ai_incidents.py
------------------------------
"AI Guardian" — nhật ký sự cố hệ thống do AI phát hiện + tự xử lý. Admin
(require_admin_or_superadmin) biên soạn qua template dựng sẵn (điền số liệu
thật), hoặc tự viết toàn bộ (category='custom').

GET    /api/v1/ai-incidents/templates   — danh sách loại sự cố + field schema
GET    /api/v1/ai-incidents             — nhật ký (timeline), mới nhất trước
POST   /api/v1/ai-incidents             — tạo 1 sự cố mới
DELETE /api/v1/ai-incidents/{id}        — xoá (lỡ tạo sai)
POST   /api/v1/ai-incidents/{id}/approve       — duyệt lỗi critical (pending_approval -> resolved)
POST   /api/v1/ai-incidents/release-batch      — phát hành bản cập nhật cuối tuần (scheduled -> resolved theo release_batch_date)
"""
from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import require_admin_or_superadmin
from app.models.user import User
from app.models.ai_incident import AIIncident
from app.services.ai_incident_service import list_templates, render_incident

router = APIRouter(prefix="/api/v1/ai-incidents", tags=["AI Guardian"])


def _fmt(i: AIIncident) -> dict:
    return {
        "incident_id":   i.incident_id,
        "category":      i.category,
        "severity":      i.severity,
        "title":         i.title,
        "root_cause":    i.root_cause,
        "actions_taken": i.actions_taken or [],
        "metrics":       i.metrics,
        "detected_at":   str(i.detected_at),
        "resolved_at":   str(i.resolved_at) if i.resolved_at else None,
        "status":        i.status,
        "proposed_solution":  i.proposed_solution,
        "release_batch_date": str(i.release_batch_date) if i.release_batch_date else None,
        "approved_by":   i.approved_by,
        "approved_at":   str(i.approved_at) if i.approved_at else None,
        "created_at":    str(i.created_at) if i.created_at else None,
    }


@router.get("/templates")
def get_templates(current_user: User = Depends(require_admin_or_superadmin)):
    return {"templates": list_templates()}


@router.get("")
def list_incidents(
    limit: int = 100,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(AIIncident)
        .order_by(AIIncident.detected_at.desc())
        .limit(limit)
        .all()
    )
    return {"incidents": [_fmt(i) for i in rows]}


@router.post("/preview")
def preview_incident(
    body: dict,
    current_user: User = Depends(require_admin_or_superadmin),
):
    """Render thử nội dung từ template — KHÔNG lưu, dùng cho form xem trước
    trước khi admin bấm lưu thật."""
    category = body.get("category")
    if not category:
        raise HTTPException(400, "Thiếu category")
    values = body.get("values") or {}
    custom = body.get("custom") or {
        "title": body.get("title"),
        "root_cause": body.get("root_cause"),
        "actions": body.get("actions"),
    }
    try:
        return render_incident(category, values, custom=custom)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("")
def create_incident(
    body: dict,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    category = body.get("category")
    if not category:
        raise HTTPException(400, "Thiếu category")

    values = body.get("values") or {}
    custom = body.get("custom") or {
        "title": body.get("title"),
        "root_cause": body.get("root_cause"),
        "actions": body.get("actions"),
    }
    try:
        rendered = render_incident(category, values, custom=custom)
    except ValueError as e:
        raise HTTPException(400, str(e))

    # Cho phép ghi đè nội dung đã render (admin sửa tay trước khi lưu)
    title = body.get("title_override") or rendered["title"]
    root_cause = body.get("root_cause_override") or rendered["root_cause"]
    actions_taken = body.get("actions_override") or rendered["actions_taken"]

    detected_at = body.get("detected_at")
    detected_at = datetime.fromisoformat(detected_at) if detected_at else datetime.now()
    resolved_at = body.get("resolved_at")
    resolved_at = datetime.fromisoformat(resolved_at) if resolved_at else None
    release_batch_date = body.get("release_batch_date")
    release_batch_date = date.fromisoformat(release_batch_date) if release_batch_date else None

    incident = AIIncident(
        category=category,
        severity=body.get("severity", "warning"),
        title=title,
        root_cause=root_cause,
        actions_taken=actions_taken,
        metrics=values or None,
        detected_at=detected_at,
        resolved_at=resolved_at,
        status=body.get("status", "resolved"),
        proposed_solution=body.get("proposed_solution") or None,
        release_batch_date=release_batch_date,
        is_seed=bool(body.get("is_seed", True)),
        created_by=current_user.user_id,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return _fmt(incident)


@router.post("/{incident_id}/approve")
def approve_incident(
    incident_id: int,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    """Duyệt 1 lỗi critical đang 'pending_approval' — coi như admin đã đọc
    giải pháp AI đề xuất (proposed_solution) và đồng ý triển khai lên hệ
    thống chính thức. Không dùng cho lỗi ở trạng thái khác."""
    i = db.query(AIIncident).filter(AIIncident.incident_id == incident_id).first()
    if not i:
        raise HTTPException(404, "Không tìm thấy sự cố")
    if i.status != "pending_approval":
        raise HTTPException(400, f"Sự cố đang ở trạng thái '{i.status}', không phải chờ duyệt")

    now = datetime.now()
    i.status = "resolved"
    i.approved_by = current_user.user_id
    i.approved_at = now
    if not i.resolved_at:
        i.resolved_at = now
    db.commit()
    db.refresh(i)
    return _fmt(i)


@router.post("/release-batch")
def release_batch(
    body: dict,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    """Phát hành bản cập nhật cuối tuần — đóng HÀNG LOẠT các lỗi nhỏ đang
    'scheduled' có cùng release_batch_date thành 'resolved' cùng lúc."""
    raw_date = body.get("release_batch_date")
    if not raw_date:
        raise HTTPException(400, "Thiếu release_batch_date")
    batch_date = date.fromisoformat(raw_date)

    rows = db.query(AIIncident).filter(
        AIIncident.status == "scheduled",
        AIIncident.release_batch_date == batch_date,
    ).all()
    if not rows:
        raise HTTPException(404, "Không có sự cố nào đang chờ ở bản cập nhật này")

    now = datetime.now()
    for i in rows:
        i.status = "resolved"
        i.resolved_at = now
        i.approved_by = current_user.user_id
        i.approved_at = now
    db.commit()
    return {"message": f"Đã phát hành bản cập nhật {raw_date} — {len(rows)} lỗi được đóng", "count": len(rows)}


@router.delete("/{incident_id}")
def delete_incident(
    incident_id: int,
    current_user: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
):
    i = db.query(AIIncident).filter(AIIncident.incident_id == incident_id).first()
    if not i:
        raise HTTPException(404, "Không tìm thấy sự cố")
    db.delete(i)
    db.commit()
    return {"message": "Đã xoá"}
