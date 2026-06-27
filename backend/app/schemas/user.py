from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime
import re

# Ký tự bị cấm trong email/username và password
_DANGEROUS = re.compile(r'[<>?/:;"\'|\\]')


def _block_dangerous(v: str, field: str = "Giá trị") -> str:
    if _DANGEROUS.search(v):
        raise ValueError(f"{field} không được chứa ký tự đặc biệt: < > ? / : ; \" ' | \\")
    return v


class UserCreate(BaseModel):
    email: str          # Cho phép username hoặc email, không bắt buộc định dạng @
    password: str
    full_name: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Email / tên đăng nhập không được để trống")
        return _block_dangerous(v, "Email")

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 3:
            raise ValueError("Mật khẩu tối thiểu 3 ký tự")
        return _block_dangerous(v, "Mật khẩu")

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v):
        return _block_dangerous(v.strip(), "Họ tên")


class UserLogin(BaseModel):
    email: str          # Chấp nhận cả username lẫn email
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        return _block_dangerous(v.strip(), "Email")

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        return _block_dangerous(v, "Mật khẩu")


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    avatar_url: Optional[str] = None


class PasswordChange(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 3:
            raise ValueError("Mật khẩu tối thiểu 3 ký tự")
        return _block_dangerous(v, "Mật khẩu")


class ForgotPassword(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        return _block_dangerous(v.strip(), "Email")


class ResetPassword(BaseModel):
    token: str
    new_password: str


class RoleResponse(BaseModel):
    role_id: int
    role_name: str
    status: str

    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    user_id: int
    email: str
    full_name: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    avatar_url: Optional[str]
    status: str
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class UserDetailResponse(UserResponse):
    roles: List[RoleResponse] = []
    current_role: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserDetailResponse


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class CurrentRoleUpdate(BaseModel):
    role: str


class ShopRegistrationCreate(BaseModel):
    shop_name: str
    description: Optional[str] = None
    address: str
    phone: Optional[str] = None
    cmnd_url: Optional[str] = None
    cmnd_back_url: Optional[str] = None
    business_reg_url: Optional[str] = None


class ShipperRegistrationCreate(BaseModel):
    vehicle_type: str
    license_plate: Optional[str] = None
    license_url: Optional[str] = None
    registration_url: Optional[str] = None
    id_card_url: Optional[str] = None


class RegistrationResponse(BaseModel):
    reg_id: int
    status: str
    created_at: Optional[datetime]

    class Config:
        from_attributes = True
