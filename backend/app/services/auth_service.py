from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User, Role, UserRole
from app.utils.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.utils.constants import DEFAULT_ROLES, DEFAULT_PERMISSIONS, RoleName
from app.schemas.user import UserCreate, UserLogin
from app.utils.email import send_welcome_email
import logging

logger = logging.getLogger(__name__)


def seed_roles_and_permissions(db: Session):
    """Seed default roles and permissions if not exists."""
    from app.models.user import Role, Permission
    for role_name in DEFAULT_ROLES:
        existing = db.query(Role).filter(Role.role_name == role_name).first()
        if not existing:
            db.add(Role(role_name=role_name, description=f"{role_name} role"))

    for code, category, description in DEFAULT_PERMISSIONS:
        existing = db.query(Permission).filter(Permission.permission_code == code).first()
        if not existing:
            db.add(Permission(permission_code=code, category=category, description=description))

    db.commit()


def register_user(db: Session, user_data: UserCreate) -> User:
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        full_name=user_data.full_name,
        status="active",
    )
    db.add(user)
    db.flush()

    # Assign default 'user' role
    user_role = db.query(Role).filter(Role.role_name == RoleName.USER).first()
    if user_role:
        db.add(UserRole(user_id=user.user_id, role_id=user_role.role_id, current_role=True))

    db.commit()
    db.refresh(user)

    try:
        send_welcome_email(user.email, user.full_name or "")
    except Exception:
        pass

    return user


def login_user(db: Session, login_data: UserLogin) -> dict:
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    if user.status == "banned":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account has been banned")

    if user.status == "inactive":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()

    token_data = {"sub": str(user.user_id)}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user,
    }


def refresh_tokens(db: Session, refresh_token: str) -> dict:
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.user_id == int(user_id), User.status == "active").first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    token_data = {"sub": str(user.user_id)}
    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "token_type": "bearer",
    }
