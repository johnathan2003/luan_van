"""
pytest fixtures dùng chung cho tất cả test files.
Chạy: cd backend && venv/Scripts/activate && pytest tests/ -v
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import *  # noqa – ensure all models registered
from app.services.auth_service import register_user, seed_roles_and_permissions
from app.schemas.user import UserCreate

# ── In-memory SQLite DB for tests ──────────────────────────────────────────────
SQLALCHEMY_TEST_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Create all tables once per test session."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_roles_and_permissions(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db():
    """Provide a clean DB session per test."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session")
def client():
    """FastAPI TestClient with overridden DB."""
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── Helper: tạo user và lấy token ──────────────────────────────────────────────
def create_user_and_login(client: TestClient, email: str, password: str = "password123", full_name: str = "Test User") -> dict:
    """Register a user and return login response data."""
    client.post("/api/v1/auth/register", json={
        "email": email,
        "password": password,
        "full_name": full_name,
    })
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed: {res.json()}"
    return res.json()


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Shared fixtures ─────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def user_token(client):
    data = create_user_and_login(client, "user@test.com")
    return data["access_token"]


@pytest.fixture(scope="module")
def admin_token(client, db):
    """Create an admin user by manually assigning the admin role."""
    from app.models.user import User, Role, UserRole
    from app.utils.security import hash_password

    existing = db.query(User).filter(User.email == "admin@test.com").first()
    if not existing:
        user = User(email="admin@test.com", password_hash=hash_password("admin123"), full_name="Admin User")
        db.add(user)
        db.flush()
        admin_role = db.query(Role).filter(Role.role_name == "admin").first()
        if admin_role:
            db.add(UserRole(user_id=user.user_id, role_id=admin_role.role_id, current_role=True))
        db.commit()

    res = client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "admin123"})
    return res.json()["access_token"]
