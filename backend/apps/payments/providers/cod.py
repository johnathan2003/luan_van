"""
Payment Providers
=================
Mỗi provider implement interface chung:
  - create_payment(order) -> payment_url hoặc None
  - verify_payment(data) -> bool
  - refund(payment, amount) -> bool

Giai đoạn 1 (MVP): Chỉ COD
Giai đoạn 2: Tích hợp MoMo, VNPay
"""
import hashlib
import hmac
import json
import uuid
from abc import ABC, abstractmethod
from django.conf import settings
from django.utils import timezone


class BasePaymentProvider(ABC):
    @abstractmethod
    def create_payment(self, order):
        pass

    @abstractmethod
    def verify_webhook(self, request_data, signature):
        pass


class CODProvider(BasePaymentProvider):
    """Cash on Delivery — không cần cổng thanh toán"""

    def create_payment(self, order):
        from apps.payments.models import Payment
        payment = Payment.objects.create(
            order=order,
            method="cod",
            amount=order.total,
            status="pending",
        )
        return {"payment_id": str(payment.id), "payment_url": None, "method": "cod"}

    def verify_webhook(self, request_data, signature):
        return True  # COD không có webhook


class MoMoProvider(BasePaymentProvider):
    """
    MoMo Payment Gateway
    Docs: https://developers.momo.vn/
    """
    ENDPOINT = "https://payment.momo.vn/v2/gateway/api/create"

    def __init__(self):
        self.partner_code = getattr(settings, "MOMO_PARTNER_CODE", "")
        self.access_key = getattr(settings, "MOMO_ACCESS_KEY", "")
        self.secret_key = getattr(settings, "MOMO_SECRET_KEY", "")

    def create_payment(self, order):
        import requests
        request_id = str(uuid.uuid4())
        order_id = f"ORDER-{order.order_number}-{request_id[:8]}"
        amount = int(order.total)
        redirect_url = f"{settings.FRONTEND_URL}/payment/callback/momo"
        ipn_url = f"{settings.BACKEND_URL}/api/v1/payments/momo/webhook/"

        raw_signature = (
            f"accessKey={self.access_key}&amount={amount}&extraData="
            f"&ipnUrl={ipn_url}&orderId={order_id}&orderInfo=Thanh toan don hang {order.order_number}"
            f"&partnerCode={self.partner_code}&redirectUrl={redirect_url}"
            f"&requestId={request_id}&requestType=payWithMethod"
        )
        signature = hmac.new(
            self.secret_key.encode(), raw_signature.encode(), hashlib.sha256
        ).hexdigest()

        payload = {
            "partnerCode": self.partner_code,
            "requestId": request_id,
            "amount": amount,
            "orderId": order_id,
            "orderInfo": f"Thanh toan don hang {order.order_number}",
            "redirectUrl": redirect_url,
            "ipnUrl": ipn_url,
            "requestType": "payWithMethod",
            "signature": signature,
            "lang": "vi",
            "extraData": "",
        }

        try:
            resp = requests.post(self.ENDPOINT, json=payload, timeout=10)
            data = resp.json()
            if data.get("resultCode") == 0:
                from apps.payments.models import Payment
                payment = Payment.objects.create(
                    order=order, method="momo", amount=order.total,
                    transaction_id=order_id, gateway_response=data,
                )
                return {"payment_id": str(payment.id), "payment_url": data.get("payUrl")}
        except Exception as e:
            raise Exception(f"MoMo payment error: {e}")

    def verify_webhook(self, request_data, signature):
        raw = (
            f"accessKey={self.access_key}&amount={request_data.get('amount')}"
            f"&extraData={request_data.get('extraData')}&message={request_data.get('message')}"
            f"&orderId={request_data.get('orderId')}&orderInfo={request_data.get('orderInfo')}"
            f"&orderType={request_data.get('orderType')}&partnerCode={self.partner_code}"
            f"&payType={request_data.get('payType')}&requestId={request_data.get('requestId')}"
            f"&responseTime={request_data.get('responseTime')}&resultCode={request_data.get('resultCode')}"
            f"&transId={request_data.get('transId')}"
        )
        expected = hmac.new(self.secret_key.encode(), raw.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)


class VNPayProvider(BasePaymentProvider):
    """
    VNPay Payment Gateway
    Docs: https://sandbox.vnpayment.vn/
    """
    ENDPOINT = "https://pay.vnpay.vn/vpcpay.html"

    def __init__(self):
        self.tmn_code = getattr(settings, "VNPAY_TMN_CODE", "")
        self.hash_secret = getattr(settings, "VNPAY_HASH_SECRET", "")

    def create_payment(self, order):
        from datetime import datetime
        import urllib.parse

        create_date = datetime.now().strftime("%Y%m%d%H%M%S")
        params = {
            "vnp_Version": "2.1.0",
            "vnp_Command": "pay",
            "vnp_TmnCode": self.tmn_code,
            "vnp_Amount": int(order.total) * 100,  # VNPay tính theo đơn vị VND * 100
            "vnp_CurrCode": "VND",
            "vnp_TxnRef": order.order_number,
            "vnp_OrderInfo": f"Thanh toan don hang {order.order_number}",
            "vnp_OrderType": "other",
            "vnp_Locale": "vn",
            "vnp_ReturnUrl": f"{settings.FRONTEND_URL}/payment/callback/vnpay",
            "vnp_IpAddr": "127.0.0.1",
            "vnp_CreateDate": create_date,
        }

        sorted_params = sorted(params.items())
        query_string = urllib.parse.urlencode(sorted_params)
        signature = hmac.new(
            self.hash_secret.encode(), query_string.encode(), hashlib.sha512
        ).hexdigest()
        payment_url = f"{self.ENDPOINT}?{query_string}&vnp_SecureHash={signature}"

        from apps.payments.models import Payment
        payment = Payment.objects.create(
            order=order, method="vnpay", amount=order.total,
            transaction_id=order.order_number,
        )
        return {"payment_id": str(payment.id), "payment_url": payment_url}

    def verify_webhook(self, request_data, signature):
        params = {k: v for k, v in request_data.items() if k != "vnp_SecureHash"}
        sorted_params = sorted(params.items())
        import urllib.parse
        query_string = urllib.parse.urlencode(sorted_params)
        expected = hmac.new(self.hash_secret.encode(), query_string.encode(), hashlib.sha512).hexdigest()
        return hmac.compare_digest(expected, signature)


def get_payment_provider(method: str) -> BasePaymentProvider:
    providers = {
        "cod": CODProvider,
        "momo": MoMoProvider,
        "vnpay": VNPayProvider,
    }
    provider_class = providers.get(method)
    if not provider_class:
        raise ValueError(f"Payment method '{method}' không được hỗ trợ")
    return provider_class()