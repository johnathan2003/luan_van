"""
disputes.py — [F-2]
User tạo khiếu nại về đơn hàng và xem danh sách khiếu nại của mình.
Admin xem và xử lý qua admin.py (đã có sẵn).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.order import Order
from app.models.dispute import Dispute

router = APIRouter()


class DisputeCreate(BaseModel):
    order_id: int
    reason: str
    evidence_urls: Optional[str] = None  # JSON string hoặc comma-separated URLs


@router.post("", status_code=201)
def create_dispute(
    data: DisputeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """[F-2] User tạo khiếu nại về đơn hàng."""
    if not data.reason.strip():
        raise HTTPException(status_code=400, detail="Lý do khiếu nại không được để trống")

    # Kiểm tra đơn hàng thuộc user
    order = db.query(Order).filter(
        Order.order_id == data.order_id,
        Order.user_id == current_user.user_id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng")

    # Chỉ cho khiếu nại khi đơn không bị hủy
    if order.order_status == "cancelled":
        raise HTTPException(status_code=400, detail="Không thể khiếu nại đơn đã hủy")

    # Kiểm tra đã có khiếu nại mở chưa
    existing = db.query(Dispute).filter(
        Dispute.order_id == data.order_id,
        Dispute.initiated_by == current_user.user_id,
        Dispute.status == "open",
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Đơn này đã có khiếu nại đang mở (#{existing.dispute_id})"
        )

    dispute = Dispute(
        order_id=data.order_id,
        initiated_by=current_user.user_id,
        initiated_party="user",
        reason=data.reason.strip(),
        evidence_urls=data.evidence_urls,
        status="open",
    )
    db.add(dispute)
    db.commit()
    db.refresh(dispute)

    return {
        "message": "Đã gửi khiếu nại thành công. Admin sẽ xem xét trong vòng 3-5 ngày làm việc.",
        "dispute_id": dispute.dispute_id,
    }


@router.get("/me")
def get_my_disputes(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """[F-2] User xem danh sách khiếu nại của mình."""
    q = db.query(Dispute).filter(Dispute.initiated_by == current_user.user_id)
    if status and status != "all":
        q = q.filter(Dispute.status == status)
    q = q.order_by(Dispute.created_at.desc())

    total = q.count()
    items = q.offset((page - 1) * limit).limit(limit).all()

    return {
        "disputes": [
            {
                "dispute_id":         d.dispute_id,
                "order_id":           d.order_id,
                "order_number":       d.order.order_number if d.order else None,
                "reason":             d.reason,
                "evidence_urls":      d.evidence_urls,
                "status":             d.status,
                "resolution_details": d.resolution_details,
                "refund_amount":      float(d.refund_amount) if d.refund_amount else None,
                "created_at":         str(d.created_at),
                "resolved_at":        str(d.resolved_at) if d.resolved_at else None,
            }
            for d in items
        ],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }
