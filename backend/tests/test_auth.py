"""
Tests cho Authentication: register, login, refresh token, password reset.
"""
import pytest
from .conftest import create_user_and_login, auth_headers


class TestRegister:
    def test_register_success(self, client):
        res = client.post("/api/v1/auth/register", json={
            "email": "newuser@test.com",
            "password": "password123",
            "full_name": "New User",
        })
        assert res.status_code == 201
        data = res.json()
        assert "user_id" in data
        assert data["email"] == "newuser@test.com"

    def test_register_duplicate_email(self, client):
        payload = {"email": "dup@test.com", "password": "pass123", "full_name": "Dup"}
        client.post("/api/v1/auth/register", json=payload)
        res = client.post("/api/v1/auth/register", json=payload)
        assert res.status_code == 400
        assert "already registered" in res.json()["detail"].lower()

    def test_register_short_password(self, client):
        res = client.post("/api/v1/auth/register", json={
            "email": "short@test.com",
            "password": "123",
            "full_name": "Short",
        })
        assert res.status_code == 422  # Pydantic validation

    def test_register_invalid_email(self, client):
        res = client.post("/api/v1/auth/register", json={
            "email": "not-an-email",
            "password": "password123",
            "full_name": "Bad",
        })
        assert res.status_code == 422


class TestLogin:
    def test_login_success(self, client):
        client.post("/api/v1/auth/register", json={
            "email": "login@test.com",
            "password": "pass1234",
            "full_name": "Login User",
        })
        res = client.post("/api/v1/auth/login", json={
            "email": "login@test.com",
            "password": "pass1234",
        })
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "login@test.com"

    def test_login_wrong_password(self, client):
        client.post("/api/v1/auth/register", json={
            "email": "wrongpass@test.com",
            "password": "correct123",
            "full_name": "Wrong",
        })
        res = client.post("/api/v1/auth/login", json={
            "email": "wrongpass@test.com",
            "password": "wrong_password",
        })
        assert res.status_code == 401

    def test_login_nonexistent_user(self, client):
        res = client.post("/api/v1/auth/login", json={
            "email": "ghost@test.com",
            "password": "anything",
        })
        assert res.status_code == 401

    def test_login_returns_user_roles(self, client):
        data = create_user_and_login(client, "roles@test.com")
        assert "user" in [r["role_name"] for r in data["user"]["roles"]]


class TestToken:
    def test_refresh_token(self, client):
        data = create_user_and_login(client, "refresh@test.com")
        res = client.post("/api/v1/auth/refresh-token", json={
            "refresh_token": data["refresh_token"]
        })
        assert res.status_code == 200
        assert "access_token" in res.json()

    def test_invalid_refresh_token(self, client):
        res = client.post("/api/v1/auth/refresh-token", json={
            "refresh_token": "invalid.token.here"
        })
        assert res.status_code == 401

    def test_logout(self, client):
        data = create_user_and_login(client, "logout@test.com")
        res = client.post("/api/v1/auth/logout", headers=auth_headers(data["access_token"]))
        assert res.status_code == 200


class TestProtectedRoute:
    def test_access_me_without_token(self, client):
        res = client.get("/api/v1/users/me")
        assert res.status_code == 403

    def test_access_me_with_token(self, client):
        data = create_user_and_login(client, "me@test.com")
        res = client.get("/api/v1/users/me", headers=auth_headers(data["access_token"]))
        assert res.status_code == 200
        assert res.json()["email"] == "me@test.com"

    def test_access_me_with_invalid_token(self, client):
        res = client.get("/api/v1/users/me", headers={"Authorization": "Bearer fake.token"})
        assert res.status_code == 401
