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
"""
from datetime import datetime
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
        is_seed=bool(body.get("is_seed", True)),
        created_by=current_user.user_id,
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return _fmt(incident)


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
