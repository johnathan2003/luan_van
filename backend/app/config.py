import os
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Database (PostgreSQL / Supabase)
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "password"
    DB_NAME: str = "postgres"

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_STORAGE_BUCKET: str = "uploads"

    # JWT
    SECRET_KEY: str = "your-super-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Momo — endpoint chuẩn theo tài liệu MoMo hiện tại (developers.momo.vn) LUÔN
    # là /v2/gateway/api/create, kể cả ở phần docs gắn nhãn "v3" (v3 chỉ là bản
    # doc site, không phải version API). Trỏ nhầm /v3/gateway/api/create sẽ
    # khiến request lỗi/hoặc không đúng định dạng MoMo mong đợi.
    MOMO_ENDPOINT: str = "https://test-payment.momo.vn/v2/gateway/api/create"
    MOMO_PARTNER_CODE: str = ""
    MOMO_ACCESS_KEY: str = ""
    MOMO_SECRET_KEY: str = ""

    # VNPay
    VNPAY_TMN_CODE: str = ""
    VNPAY_HASH_SECRET: str = ""
    VNPAY_URL: str = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
    # Trang FE mà VNPay chuyển trình duyệt người dùng về sau khi thanh toán xong
    VNPAY_RETURN_URL: str = "http://localhost:3000/payment/result"

    # ZaloPay — sandbox v2 (docs.zalopay.vn). app_id/key1/key2 để trống thì hệ
    # thống tự chuyển sang demo mode (giả lập), giống Momo/VNPay.
    ZALOPAY_ENDPOINT: str = "https://sb-openapi.zalopay.vn/v2/create"
    ZALOPAY_APP_ID: str = ""
    ZALOPAY_KEY1: str = ""
    ZALOPAY_KEY2: str = ""

    # Server
    SERVER_HOST: str = "0.0.0.0"
    SERVER_PORT: int = int(os.environ.get("PORT", 8000))
    DEBUG: bool = True
    ENVIRONMENT: str = "development"
    FRONTEND_URL: str = "http://localhost:3000"
    # URL backend PUBLIC (VNPay/MoMo gọi được từ internet) — dùng để build ipnUrl
    # gửi cho MoMo lúc tạo giao dịch. Chạy local phải trỏ ra domain ngrok/tunnel,
    # KHÔNG được để localhost/0.0.0.0 vì MoMo gọi từ server của họ, không phải máy bạn.
    BACKEND_URL: str = "http://localhost:8000"

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # Email
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SENDER_EMAIL: str = "noreply@ecommerce.com"

    # File Upload
    UPLOAD_FOLDER: str = "uploads"
    MAX_FILE_SIZE: int = 10485760  # 10MB

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""
    REDIS_DB: int = 0

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/app.log"

    # Gemini (Chatbot)
    GEMINI_API_KEY: str = ""

    @property
    def DATABASE_URL(self):
        return "postgresql+psycopg2://{}:{}@{}:{}/{}".format(
            self.DB_USER, self.DB_PASSWORD, self.DB_HOST, self.DB_PORT, self.DB_NAME
        )

    @property
    def ALLOWED_ORIGINS_LIST(self):
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
