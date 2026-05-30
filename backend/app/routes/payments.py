from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.payment import Payment
from app.schemas.payment import MomoCreateRequest, VNPayCreateRequest
from app.services.payment_service import create_momo_payment, handle_momo_callback, create_vnpay_url

router = APIRouter()


@router.post("/momo/create")
def momo_create(
    data: MomoCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = create_momo_payment(db, data.order_id, data.amount, data.order_info)
    return result


@router.get("/momo/callback")
@router.post("/momo/ipn")
async def momo_callback(request: Request, db: Session = Depends(get_db)):
    data = dict(request.query_params)
    if not data:
        data = await request.json()
    result = handle_momo_callback(db, data)
    return result


@router.post("/vnpay/create")
def vnpay_create(
    data: VNPayCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ip_addr = request.client.host if request.client else "127.0.0.1"
    url = create_vnpay_url(data.order_id, data.amount, data.order_desc, data.bank_code, ip_addr)
    return {"payment_url": url}


@router.get("/history")
def payment_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.order import Order
    payments = db.query(Payment).join(Order, Payment.order_id == Order.order_id).filter(
        Order.user_id == current_user.user_id
    ).order_by(Payment.created_at.desc()).all()
    return {
        "payments": [
            {
                "payment_id": p.payment_id,
                "order_id": p.order_id,
                "amount": p.amount,
                "method": p.method,
                "status": p.status,
                "trans_id": p.trans_id,
                "created_at": str(p.created_at),
            }
            for p in payments
        ]
    }
