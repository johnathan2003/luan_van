from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.user import UserCreate, UserLogin, RefreshTokenRequest, ForgotPassword, ResetPassword, TokenResponse
from app.services.auth_service import register_user, login_user, refresh_tokens
from app.utils.security import create_password_reset_token, verify_password_reset_token
from app.utils.email import send_password_reset_email
from app.models.user import User
from app.utils.security import hash_password

router = APIRouter()


@router.post("/register", status_code=201)
def register(data: UserCreate, db: Session = Depends(get_db)):
    user = register_user(db, data)
    return {"message": "Registration successful", "user_id": user.user_id, "email": user.email}


@router.post("/login")
def login(data: UserLogin, db: Session = Depends(get_db)):
    result = login_user(db, data)
    user = result["user"]
    # Build roles list
    roles = [
        {"role_id": ur.role_id, "role_name": ur.role.role_name, "status": ur.status}
        for ur in user.user_roles
        if ur.status == "active"
    ]
    current_role = next((ur.role.role_name for ur in user.user_roles if ur.current_role), None)
    return {
        "access_token": result["access_token"],
        "refresh_token": result["refresh_token"],
        "token_type": "bearer",
        "user": {
            "user_id": user.user_id,
            "email": user.email,
            "full_name": user.full_name,
            "avatar_url": user.avatar_url,
            "roles": roles,
            "current_role": current_role,
        },
    }


@router.post("/refresh-token")
def refresh_token(data: RefreshTokenRequest, db: Session = Depends(get_db)):
    return refresh_tokens(db, data.refresh_token)


@router.post("/logout")
def logout():
    return {"message": "Logged out successfully"}


@router.post("/forgot-password")
def forgot_password(data: ForgotPassword, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if user:
        token = create_password_reset_token(data.email)
        send_password_reset_email(data.email, token)
    return {"message": "If your email is registered, you will receive a reset link"}


@router.post("/reset-password")
def reset_password(data: ResetPassword, db: Session = Depends(get_db)):
    email = verify_password_reset_token(data.token)
    if not email:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "Password reset successful"}
