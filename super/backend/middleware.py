"""
super/backend/middleware.py
---------------------------
require_super() — dependency dùng cho mọi endpoint superadmin.
KHÔNG tra DB, KHÔNG ghi log.
Chỉ giải mã JWT và kiểm tra role claim = 'superadmin'.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.utils.security import decode_token

security = HTTPBearer()


def require_super(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Xác thực superadmin từ JWT.
    - Không tra bảng users
    - Không ghi admin_logs
    - Chỉ kiểm tra payload['role'] == 'superadmin'
    """
    payload = decode_token(credentials.credentials)

    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ hoặc đã hết hạn",
        )

    if payload.get("role") != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Endpoint này chỉ dành cho superadmin",
        )

    return payload  # trả payload thay vì User object
