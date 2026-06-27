"""
super/backend/config.py
-----------------------
Thông tin đăng nhập superadmin lưu dạng PLAINTEXT trong env.
Không dùng bcrypt — superadmin nằm ngoài bảng băm của hệ thống.
"""
import os

SUPER_USERNAME: str = os.getenv("SUPER_USERNAME", "super")
SUPER_PASSWORD: str = os.getenv("SUPER_PASSWORD", "super")
