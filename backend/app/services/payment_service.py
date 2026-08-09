import hashlib
import hmac
import json
import uuid
import urllib.parse
from datetime import datetime, timedelta
import httpx
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.config import settings
from app.models.payment import Payment
from app.models.order import Order

# ── Demo mode (giả lập MoMo, không gọi API thật) ─────────────────────────────
# Dùng cho bảo vệ đồ án: tự bật khi chưa cấu hình merchant MoMo thật trong
# .env (MOMO_PARTNER_CODE/ACCESS_KEY/SECRET_KEY rỗng) — tránh phụ thuộc mạng
# ngoài + tài khoản MoMo thật lúc demo trước hội đồng. Khi điền key thật vào
# .env, hệ thống tự động chuyển lại dùng luồng MoMo thật (create_momo_payment
# bên dưới), không cần đổi code gì thêm.
MOMO_DEMO_TTL_SECONDS = 60


def is_momo_demo_mode() -> bool:
    return not (settings.MOMO_PARTNER_CODE and settings.MOMO_ACCESS_KEY and settings.MOMO_SECRET_KEY)


def create_momo_payment(
    db: Session,
    order_id: int,
    amount: int,
    order_info: str = None,
    redirect_url: str = None,
    request_type: str = "captureWallet",
) -> dict:
    """request_type: "captureWallet" (ví MoMo thông thường) hoặc "payWithVTS"
    (Ví Trả Sau — MoMo Pay Later). Theo tài liệu MoMo hiện tại, cả 2 dùng
    chung 1 endpoint /v2/gateway/api/create và cùng công thức chữ ký, chỉ khác
    giá trị requestType."""
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if is_momo_demo_mode():
        # Không gọi ra ngoài Internet — trả về link nội bộ tới trang QR giả lập.
        # Payment record (đã được tạo lúc create_order) giữ nguyên status
        # "pending"; created_at của nó (đã có sẵn) làm mốc tính hết hạn 60s
        # cho cả trang QR gốc lẫn trang giả lập MoMo, khỏi cần thêm cột mới.
        payment = db.query(Payment).filter(Payment.order_id == order_id).first()
        if payment:
            payment.momo_response = {"demo": True, "request_type": request_type}
            db.commit()
        return {
            "payUrl": f"{settings.FRONTEND_URL.rstrip('/')}/checkout/momo/{order_id}",
            "resultCode": 0,
            "message": "Demo mode — chưa cấu hình merchant MoMo thật",
        }

    request_id = str(uuid.uuid4())
    order_ref = f"ORDER_{order_id}_{int(datetime.utcnow().timestamp())}"
    redirect_url = redirect_url or f"{settings.FRONTEND_URL}/payment/result"
    # BACKEND_URL phải là domain gọi được từ internet (MoMo server gọi vào đây) —
    # KHÔNG dùng SERVER_HOST (thường là "0.0.0.0", chỉ có nghĩa để bind cổng,
    # không phải địa chỉ MoMo gọi tới được).
    ipn_url = f"{settings.BACKEND_URL.rstrip('/')}/api/v1/payments/momo/ipn"

    raw_signature = (
        f"accessKey={settings.MOMO_ACCESS_KEY}"
        f"&amount={amount}"
        f"&extraData="
        f"&ipnUrl={ipn_url}"
        f"&orderId={order_ref}"
        f"&orderInfo={order_info or f'Payment for order {order_id}'}"
        f"&partnerCode={settings.MOMO_PARTNER_CODE}"
        f"&redirectUrl={redirect_url}"
        f"&requestId={request_id}"
        f"&requestType={request_type}"
    )

    signature = hmac.new(
        settings.MOMO_SECRET_KEY.encode("utf-8"),
        raw_signature.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    payload = {
        "partnerCode": settings.MOMO_PARTNER_CODE,
        "requestId": request_id,
        "amount": amount,
        "orderId": order_ref,
        "orderInfo": order_info or f"Payment for order {order_id}",
        "redirectUrl": redirect_url,
        "ipnUrl": ipn_url,
        "requestType": request_type,
        "extraData": "",
        "lang": "vi",
        "signature": signature,
    }

    try:
        response = httpx.post(settings.MOMO_ENDPOINT, json=payload, timeout=30)
        data = response.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Momo API error: {e}")

    # Save to payment record
    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if payment:
        payment.momo_request_id = request_id
        payment.momo_response = data
        db.commit()

    return data


def verify_momo_callback(data: dict) -> bool:
    raw_signature = (
        f"accessKey={settings.MOMO_ACCESS_KEY}"
        f"&amount={data.get('amount')}"
        f"&extraData={data.get('extraData', '')}"
        f"&message={data.get('message')}"
        f"&orderId={data.get('orderId')}"
        f"&orderInfo={data.get('orderInfo')}"
        f"&orderType={data.get('orderType')}"
        f"&partnerCode={data.get('partnerCode')}"
        f"&payType={data.get('payType')}"
        f"&requestId={data.get('requestId')}"
        f"&responseTime={data.get('responseTime')}"
        f"&resultCode={data.get('resultCode')}"
        f"&transId={data.get('transId')}"
    )
    expected = hmac.new(
        settings.MOMO_SECRET_KEY.encode("utf-8"),
        raw_signature.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return expected == data.get("signature")


def handle_momo_callback(db: Session, data: dict) -> dict:
    if not verify_momo_callback(data):
        raise HTTPException(status_code=400, detail="Invalid Momo signature")

    order_ref = data.get("orderId", "")
    try:
        order_id = int(order_ref.split("_")[1])
    except (IndexError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid order ID in callback")

    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if data.get("resultCode") == 0:
        payment.status = "success"
        payment.trans_id = str(data.get("transId"))
        order = db.query(Order).filter(Order.order_id == order_id).first()
        if order:
            order.payment_status = "paid"
    else:
        payment.status = "failed"
        order = db.query(Order).filter(Order.order_id == order_id).first()
        if order:
            order.payment_status = "failed"

    payment.momo_response = data
    db.commit()

    return {"status": "success" if data.get("resultCode") == 0 else "failed", "order_id": order_id}


def _vnpay_sign(params: dict) -> str:
    """HMAC-SHA512 theo đúng cách VNPay yêu cầu: sort key, urlencode (quote_plus,
    khớp với urlencode mặc định), rồi hash — dùng chung cho lúc tạo URL và lúc
    verify chữ ký trả về (return URL / IPN)."""
    sorted_params = sorted(params.items())
    query_string = urllib.parse.urlencode(sorted_params)
    return hmac.new(
        settings.VNPAY_HASH_SECRET.encode("utf-8"),
        query_string.encode("utf-8"),
        hashlib.sha512,
    ).hexdigest()


def is_vnpay_demo_mode() -> bool:
    return not (settings.VNPAY_TMN_CODE and settings.VNPAY_HASH_SECRET)


def create_vnpay_url(
    db: Session,
    order_id: int,
    amount: int,
    order_desc: str = None,
    bank_code: str = None,
    ip_addr: str = "127.0.0.1",
) -> str:
    """Create VNPay payment URL."""
    if is_vnpay_demo_mode():
        # Giống Momo: chưa có VNPAY_TMN_CODE/HASH_SECRET thật → không gọi
        # sandbox VNPay, trả thẳng link nội bộ tới trang QR giả lập.
        return f"{settings.FRONTEND_URL.rstrip('/')}/checkout/vnpay/{order_id}"

    txn_ref = f"{order_id}_{int(datetime.utcnow().timestamp())}"
    vnp_params = {
        "vnp_Version": "2.1.0",
        "vnp_Command": "pay",
        "vnp_TmnCode": settings.VNPAY_TMN_CODE,
        "vnp_Locale": "vn",
        "vnp_CurrCode": "VND",
        "vnp_TxnRef": txn_ref,
        "vnp_OrderInfo": order_desc or f"Payment for order {order_id}",
        "vnp_OrderType": "other",
        "vnp_Amount": amount * 100,
        "vnp_ReturnUrl": settings.VNPAY_RETURN_URL,
        "vnp_IpAddr": ip_addr,
        "vnp_CreateDate": datetime.utcnow().strftime("%Y%m%d%H%M%S"),
    }
    if bank_code:
        vnp_params["vnp_BankCode"] = bank_code

    hmac_hash = _vnpay_sign(vnp_params)
    query_string = urllib.parse.urlencode(sorted(vnp_params.items()))

    # Lưu lại txn_ref để lúc return/IPN có thể tra ngược ra order_id, đồng thời
    # dùng amount đã lưu ở đây để đối chiếu chống gian lận (sửa amount trên URL).
    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if payment:
        payment.vnpay_txn_ref = txn_ref
        db.commit()

    return f"{settings.VNPAY_URL}?{query_string}&vnp_SecureHash={hmac_hash}"


def verify_vnpay_signature(params: dict) -> bool:
    """Verify chữ ký VNPay trả về (dùng chung cho return URL và IPN)."""
    data = {k: v for k, v in params.items() if k not in ("vnp_SecureHash", "vnp_SecureHashType")}
    received_hash = params.get("vnp_SecureHash", "")
    expected_hash = _vnpay_sign(data)
    return hmac.compare_digest(expected_hash.lower(), str(received_hash).lower())


def _vnpay_order_id_from_txnref(txn_ref: str) -> int:
    try:
        return int(str(txn_ref).split("_")[0])
    except (IndexError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid vnp_TxnRef")


def handle_vnpay_return(db: Session, params: dict) -> dict:
    """Xử lý khi trình duyệt người dùng được VNPay chuyển hướng về (return URL).
    Dùng để hiển thị kết quả cho người dùng ngay — không thay thế IPN, nhưng
    hoạt động được cả khi chạy local (không cần public URL) vì đây là trình
    duyệt của chính người dùng điều hướng, không phải server VNPay gọi vào."""
    if not verify_vnpay_signature(params):
        raise HTTPException(status_code=400, detail="Invalid VNPay signature")

    order_id = _vnpay_order_id_from_txnref(params.get("vnp_TxnRef", ""))
    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    response_code = params.get("vnp_ResponseCode")
    success = response_code == "00"

    # Chỉ ghi đè trạng thái nếu chưa có kết quả cuối cùng — tránh trường hợp
    # IPN đã xử lý xong trước rồi return URL tới sau lại ghi đè nhầm.
    if payment.status == "pending":
        payment.status = "success" if success else "failed"
        payment.trans_id = params.get("vnp_TransactionNo") or payment.trans_id
        payment.vnpay_response = params
        order = db.query(Order).filter(Order.order_id == order_id).first()
        if order:
            order.payment_status = "paid" if success else "failed"
        db.commit()

    return {"status": "success" if success else "failed", "order_id": order_id}


def handle_vnpay_ipn(db: Session, params: dict) -> dict:
    """Server-to-server IPN từ VNPay — PHẢI trả đúng format {"RspCode", "Message"}
    VNPay quy định, không phải JSON tuỳ ý, nếu không VNPay sẽ coi là lỗi và gọi
    lại nhiều lần. Cần cấu hình URL này trong trang quản trị sandbox VNPay."""
    if not verify_vnpay_signature(params):
        return {"RspCode": "97", "Message": "Invalid signature"}

    try:
        order_id = _vnpay_order_id_from_txnref(params.get("vnp_TxnRef", ""))
    except HTTPException:
        return {"RspCode": "01", "Message": "Order not found"}

    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if not payment:
        return {"RspCode": "01", "Message": "Order not found"}

    try:
        vnp_amount = int(params.get("vnp_Amount", 0)) / 100
    except (TypeError, ValueError):
        vnp_amount = None
    if vnp_amount is None or round(float(payment.amount), 2) != round(vnp_amount, 2):
        return {"RspCode": "04", "Message": "Invalid amount"}

    if payment.status != "pending":
        return {"RspCode": "02", "Message": "Order already confirmed"}

    success = params.get("vnp_ResponseCode") == "00"
    payment.status = "success" if success else "failed"
    payment.trans_id = params.get("vnp_TransactionNo") or payment.trans_id
    payment.vnpay_response = params
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if order:
        order.payment_status = "paid" if success else "failed"
    db.commit()

    return {"RspCode": "00", "Message": "Confirm Success"}


# ── ZaloPay (sandbox v2 — docs.zalopay.vn) ────────────────────────────────────

def is_zalopay_demo_mode() -> bool:
    return not (settings.ZALOPAY_APP_ID and settings.ZALOPAY_KEY1 and settings.ZALOPAY_KEY2)


def create_zalopay_payment(db: Session, order_id: int, amount: int, order_info: str = None) -> dict:
    """Tạo giao dịch ZaloPay. app_trans_id bắt buộc theo format yymmdd_<unique>
    (quy định của ZaloPay để họ nhận diện ngày giao dịch)."""
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if is_zalopay_demo_mode():
        payment = db.query(Payment).filter(Payment.order_id == order_id).first()
        if payment:
            payment.zalopay_response = {"demo": True}
            db.commit()
        return {
            "order_url": f"{settings.FRONTEND_URL.rstrip('/')}/checkout/zalopay/{order_id}",
            "return_code": 1,
            "return_message": "Demo mode — chưa cấu hình merchant ZaloPay thật",
        }

    app_trans_id = f"{datetime.utcnow().strftime('%y%m%d')}_{order_id}_{int(datetime.utcnow().timestamp())}"
    app_time = int(datetime.utcnow().timestamp() * 1000)
    embed_data = json.dumps({"redirecturl": f"{settings.FRONTEND_URL.rstrip('/')}/payment/result"})
    item = json.dumps([])
    app_user = f"user_{order.user_id}"

    raw_signature = (
        f"{settings.ZALOPAY_APP_ID}|{app_trans_id}|{app_user}|{amount}|"
        f"{app_time}|{embed_data}|{item}"
    )
    mac = hmac.new(
        settings.ZALOPAY_KEY1.encode("utf-8"),
        raw_signature.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    payload = {
        "app_id": settings.ZALOPAY_APP_ID,
        "app_trans_id": app_trans_id,
        "app_user": app_user,
        "app_time": app_time,
        "amount": amount,
        "item": item,
        "embed_data": embed_data,
        "description": order_info or f"Payment for order {order_id}",
        "bank_code": "",
        "callback_url": f"{settings.BACKEND_URL.rstrip('/')}/api/v1/payments/zalopay/callback",
        "mac": mac,
    }

    try:
        response = httpx.post(settings.ZALOPAY_ENDPOINT, json=payload, timeout=30)
        data = response.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ZaloPay API error: {e}")

    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if payment:
        payment.zalopay_app_trans_id = app_trans_id
        payment.zalopay_response = data
        db.commit()

    return data


def verify_zalopay_callback(data: dict) -> bool:
    """ZaloPay gửi callback dạng {"data": "<json string>", "mac": "<hmac>"} —
    verify bằng key2 (khác key1 dùng lúc tạo giao dịch)."""
    raw_data = data.get("data", "")
    expected_mac = hmac.new(
        settings.ZALOPAY_KEY2.encode("utf-8"),
        raw_data.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected_mac, str(data.get("mac", "")))


def handle_zalopay_callback(db: Session, raw: dict) -> dict:
    """Server-to-server callback từ ZaloPay. Trả đúng format {"return_code","return_message"}
    ZaloPay quy định (1 = nhận thành công, 0/khác = lỗi, họ sẽ gọi lại)."""
    if not verify_zalopay_callback(raw):
        return {"return_code": -1, "return_message": "mac not equal"}

    try:
        inner = json.loads(raw.get("data", "{}"))
    except (TypeError, ValueError):
        return {"return_code": 0, "return_message": "invalid data"}

    app_trans_id = inner.get("app_trans_id", "")
    payment = db.query(Payment).filter(Payment.zalopay_app_trans_id == app_trans_id).first()
    if not payment:
        return {"return_code": 0, "return_message": "payment not found"}

    if payment.status != "pending":
        return {"return_code": 1, "return_message": "already confirmed"}

    payment.status = "success"
    payment.trans_id = str(inner.get("zp_trans_id") or "")
    payment.zalopay_response = inner
    order = db.query(Order).filter(Order.order_id == payment.order_id).first()
    if order:
        order.payment_status = "paid"
    db.commit()

    return {"return_code": 1, "return_message": "success"}


# ── Demo (Momo/VNPay/ZaloPay dùng chung): status / confirm / regenerate ─────
# 3 hàm này chỉ thao tác trên bảng payments/orders sẵn có (không có bảng mới),
# dùng chung "status" pending/success/expired với luồng thật ở trên —
# PaymentResultPage.tsx và các trang "Đơn hàng của tôi" đọc y hệt trường này.

def _get_payment_or_404(db: Session, order_id: int) -> Payment:
    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


def get_momo_demo_status(db: Session, order_id: int) -> dict:
    payment = _get_payment_or_404(db, order_id)
    expires_at = payment.created_at + timedelta(seconds=MOMO_DEMO_TTL_SECONDS)
    if payment.status == "pending" and datetime.utcnow() >= expires_at:
        payment.status = "expired"
        db.commit()
    return {
        "order_id": order_id,
        "status": payment.status,
        "amount": float(payment.amount),
        "expires_at": expires_at.isoformat(),
    }


def confirm_momo_demo_payment(db: Session, order_id: int) -> dict:
    payment = _get_payment_or_404(db, order_id)
    expires_at = payment.created_at + timedelta(seconds=MOMO_DEMO_TTL_SECONDS)
    if datetime.utcnow() >= expires_at:
        if payment.status == "pending":
            payment.status = "expired"
            db.commit()
        raise HTTPException(status_code=400, detail="Mã đã hết hạn")
    if payment.status != "pending":
        raise HTTPException(status_code=400, detail=f"Giao dịch đã ở trạng thái '{payment.status}', không thể xác nhận lại")

    payment.status = "success"
    payment.trans_id = f"DEMO{order_id}{int(datetime.utcnow().timestamp())}"
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if order:
        order.payment_status = "paid"
    db.commit()
    return {
        "status": "success",
        "order_id": order_id,
        "amount": float(payment.amount),
        "confirmed_at": datetime.utcnow().isoformat(),
    }


def regenerate_momo_demo_payment(db: Session, order_id: int) -> dict:
    """Nút 'Tạo lại mã QR' khi đã hết hạn — reset lại mốc 60s trên cùng 1
    payment record (order:payment vẫn là 1:1, không tạo record mới)."""
    payment = _get_payment_or_404(db, order_id)
    if payment.status == "success":
        raise HTTPException(status_code=400, detail="Đơn hàng đã thanh toán thành công, không thể tạo lại mã")
    payment.status = "pending"
    payment.created_at = datetime.utcnow()
    payment.trans_id = None
    db.commit()
    expires_at = payment.created_at + timedelta(seconds=MOMO_DEMO_TTL_SECONDS)
    return {
        "order_id": order_id,
        "status": payment.status,
        "amount": float(payment.amount),
        "expires_at": expires_at.isoformat(),
    }
