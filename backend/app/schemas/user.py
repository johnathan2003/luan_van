from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime
import re


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


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
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class ForgotPassword(BaseModel):
    email: EmailStr


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
