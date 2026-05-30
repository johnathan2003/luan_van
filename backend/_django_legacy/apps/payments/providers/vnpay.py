import hashlib
import requests
from django.conf import settings
from urllib.parse import urlencode

class VNPayProvider:
    name = 'vnpay'
    
    def __init__(self):
        self.tmn_code = getattr(settings, 'VNPAY_TMN_CODE', '')
        self.secret = getattr(settings, 'VNPAY_SECRET', '')
        self.vnp_url = getattr(settings, 'VNPAY_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html')

    def create_payment(self, order_id, amount):
        """Create VNPay payment request"""
        params = {
            'vnp_Version': '2.1.0',
            'vnp_TmnCode': self.tmn_code,
            'vnp_Amount': amount * 100,  # VND unit
            'vnp_Command': 'pay',
            'vnp_CreateDate': '20240101T000000',
            'vnp_CurrCode': 'VND',
            'vnp_IpAddr': '127.0.0.1',
            'vnp_Locale': 'vn',
            'vnp_OrderInfo': f'Payment for Order {order_id}',
            'vnp_OrderType': 'other',
            'vnp_ReturnUrl': 'http://localhost:8000/api/payments/vnpay-return/',
            'vnp_TxnRef': str(order_id),
        }
        
        querystring = urlencode(sorted(params.items()))
        vnp_SecureHash = hashlib.sha512((querystring + self.secret).encode()).hexdigest()
        params['vnp_SecureHash'] = vnp_SecureHash
        
        payment_url = f"{self.vnp_url}?{querystring}&vnp_SecureHash={vnp_SecureHash}"
        
        return {
            'provider': self.name,
            'payment_url': payment_url,
            'status': 'pending'
        }

    def verify_payment(self, data):
        """Verify VNPay callback"""
        # Implementation for payment verification
        secure_hash = data.pop('vnp_SecureHash', '')
        querystring = urlencode(sorted(data.items()))
        vnp_SecureHash = hashlib.sha512((querystring + self.secret).encode()).hexdigest()
        return vnp_SecureHash == secure_hash

