from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.order import Order
from app.models.payment import Payment
from app.schemas.payment import MomoCreateRequest, VNPayCreateRequest, ZaloPayCreateRequest
from app.services.payment_service import (
    create_momo_payment,
    handle_momo_callback,
    create_vnpay_url,
    handle_vnpay_return,
    handle_vnpay_ipn,
    create_zalopay_payment,
    handle_zalopay_callback,
    get_momo_demo_status,
    confirm_momo_demo_payment,
    regenerate_momo_demo_payment,
)

router = APIRouter()


def _owned_order_or_404(db: Session, order_id: int, current_user: User) -> Order:
    """Chặn user A xem/đổi trạng thái thanh toán của đơn hàng user B."""
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order or order.user_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


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


@router.get("/momo/return")
async def momo_return(request: Request, db: Session = Depends(get_db)):
    """Trình duyệt người dùng được MoMo redirect về đây (redirectUrl) — verify
    lại chữ ký và trả kết quả cho FE hiển thị. IPN thật (server-to-server,
    đáng tin cậy hơn vì không đi qua trình duyệt người dùng) vẫn là /momo/ipn."""
    data = dict(request.query_params)
    result = handle_momo_callback(db, data)
    return result


@router.get("/demo/status/{order_id}")
def demo_payment_status(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Polling dùng chung cho trang QR gốc + trang giả lập app (Momo/VNPay/
    ZaloPay đều đi qua đây — provider-agnostic, chỉ đọc bảng payments theo
    order_id) — cả 2 tab tính countdown từ cùng expires_at nên luôn khớp nhau."""
    _owned_order_or_404(db, order_id, current_user)
    return get_momo_demo_status(db, order_id)


@router.post("/demo/confirm/{order_id}")
def demo_payment_confirm(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _owned_order_or_404(db, order_id, current_user)
    return confirm_momo_demo_payment(db, order_id)


@router.post("/demo/regenerate/{order_id}")
def demo_payment_regenerate(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _owned_order_or_404(db, order_id, current_user)
    return regenerate_momo_demo_payment(db, order_id)


@router.post("/zalopay/create")
def zalopay_create(
    data: ZaloPayCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_zalopay_payment(db, data.order_id, data.amount, data.order_info)


@router.post("/zalopay/callback")
async def zalopay_callback(request: Request, db: Session = Depends(get_db)):
    """Server-to-server callback từ ZaloPay — PHẢI trả đúng format
    {"return_code","return_message"} theo quy định ZaloPay."""
    raw = await request.json()
    return handle_zalopay_callback(db, raw)


@router.post("/vnpay/create")
def vnpay_create(
    data: VNPayCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ip_addr = request.client.host if request.client else "127.0.0.1"
    url = create_vnpay_url(db, data.order_id, data.amount, data.order_desc, data.bank_code, ip_addr)
    return {"payment_url": url}


@router.get("/vnpay/return")
async def vnpay_return(request: Request, db: Session = Depends(get_db)):
    """Trình duyệt người dùng được VNPay redirect về đây (vnp_ReturnUrl) —
    chỉ dùng để hiển thị kết quả ngay cho người dùng. Nguồn xác nhận đáng tin
    cậy nhất vẫn là /vnpay/ipn (server-to-server), cấu hình riêng trong trang
    quản trị sandbox VNPay."""
    params = dict(request.query_params)
    return handle_vnpay_return(db, params)


@router.get("/vnpay/ipn")
async def vnpay_ipn(request: Request, db: Session = Depends(get_db)):
    """IPN server-to-server từ VNPay. PHẢI trả đúng {"RspCode", "Message"} —
    đây không phải JSON tự do, VNPay đọc RspCode để quyết định có gọi lại nữa
    không. Cấu hình URL này (vd https://<ngrok-domain>/api/v1/payments/vnpay/ipn)
    trong trang quản trị sandbox VNPay ở mục IPN URL."""
    params = dict(request.query_params)
    return handle_vnpay_ipn(db, params)


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
