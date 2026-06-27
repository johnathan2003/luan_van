"""
super/backend/auth.py
---------------------
POST /super/auth/login — đăng nhập superadmin.
Bỏ qua bảng băm: so sánh plaintext trực tiếp với env vars.
Không tra bảng users, không dùng bcrypt.
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from app.utils.security import create_access_token
from .config import SUPER_USERNAME, SUPER_PASSWORD

router = APIRouter()


class SuperLoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def super_login(data: SuperLoginRequest):
    """
    Xác thực superadmin bằng plaintext — bỏ qua bcrypt.
    Thành công → trả JWT với role='superadmin'.
    """
    # So sánh trực tiếp, không hash
    if data.username != SUPER_USERNAME or data.password != SUPER_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sai thông tin đăng nhập superadmin",
        )

    token = create_access_token({
        "sub": "superadmin",   # không phải user_id trong DB
        "role": "superadmin",  # claim riêng, không dựa vào DB roles
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": SUPER_USERNAME,
    }
