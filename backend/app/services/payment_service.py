import hashlib
import hmac
import json
import uuid
import urllib.parse
from datetime import datetime
import httpx
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.config import settings
from app.models.payment import Payment
from app.models.order import Order


def create_momo_payment(db: Session, order_id: int, amount: int, order_info: str = None, redirect_url: str = None) -> dict:
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    request_id = str(uuid.uuid4())
    order_ref = f"ORDER_{order_id}_{int(datetime.utcnow().timestamp())}"
    redirect_url = redirect_url or f"{settings.FRONTEND_URL}/payment/momo-result"
    ipn_url = f"http://{settings.SERVER_HOST}:{settings.SERVER_PORT}/api/v1/payments/momo/ipn"

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
        f"&requestType=payWithMethod"
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
        "requestType": "payWithMethod",
        "extraData": "",
        "lang": "vi",
        "signature": signature,
    }

    try:
        response = httpx.post(settings.MOMO_ENDPOINT, json=payload, timeout=10)
        data = response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Momo API error: {e}")

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


def create_vnpay_url(order_id: int, amount: int, order_desc: str = None, bank_code: str = None, ip_addr: str = "127.0.0.1") -> str:
    """Create VNPay payment URL."""
    vnp_params = {
        "vnp_Version": "2.1.0",
        "vnp_Command": "pay",
        "vnp_TmnCode": settings.VNPAY_TMN_CODE,
        "vnp_Locale": "vn",
        "vnp_CurrCode": "VND",
        "vnp_TxnRef": f"{order_id}_{int(datetime.utcnow().timestamp())}",
        "vnp_OrderInfo": order_desc or f"Payment for order {order_id}",
        "vnp_OrderType": "other",
        "vnp_Amount": amount * 100,
        "vnp_ReturnUrl": settings.VNPAY_RETURN_URL,
        "vnp_IpAddr": ip_addr,
        "vnp_CreateDate": datetime.utcnow().strftime("%Y%m%d%H%M%S"),
    }
    if bank_code:
        vnp_params["vnp_BankCode"] = bank_code

    sorted_params = sorted(vnp_params.items())
    query_string = urllib.parse.urlencode(sorted_params)

    hmac_hash = hmac.new(
        settings.VNPAY_HASH_SECRET.encode("utf-8"),
        query_string.encode("utf-8"),
        hashlib.sha512,
    ).hexdigest()

    return f"{settings.VNPAY_URL}?{query_string}&vnp_SecureHash={hmac_hash}"
