"""
Tests cho User profile APIs: get/update profile, change password, role switch.
"""
import pytest
from .conftest import create_user_and_login, auth_headers


class TestProfile:
    def test_get_profile(self, client, user_token):
        res = client.get("/api/v1/users/me", headers=auth_headers(user_token))
        assert res.status_code == 200
        data = res.json()
        assert "email" in data
        assert "roles" in data
        assert "current_role" in data

    def test_update_profile(self, client):
        data = create_user_and_login(client, "updateme@test.com")
        token = data["access_token"]

        res = client.put("/api/v1/users/me", json={
            "full_name": "Updated Name",
            "phone": "0901111222",
            "address": "456 Update St",
        }, headers=auth_headers(token))
        assert res.status_code == 200

        # Verify
        me = client.get("/api/v1/users/me", headers=auth_headers(token))
        assert me.json()["full_name"] == "Updated Name"
        assert me.json()["phone"] == "0901111222"

    def test_change_password_success(self, client):
        data = create_user_and_login(client, "changepw@test.com", "OldPass123")
        token = data["access_token"]

        res = client.put("/api/v1/users/me/password", json={
            "old_password": "OldPass123",
            "new_password": "NewPass456",
        }, headers=auth_headers(token))
        assert res.status_code == 200

        # Old password should no longer work
        login_old = client.post("/api/v1/auth/login", json={
            "email": "changepw@test.com",
            "password": "OldPass123",
        })
        assert login_old.status_code == 401

        # New password should work
        login_new = client.post("/api/v1/auth/login", json={
            "email": "changepw@test.com",
            "password": "NewPass456",
        })
        assert login_new.status_code == 200

    def test_change_password_wrong_old(self, client):
        data = create_user_and_login(client, "wrongold@test.com", "correct123")
        token = data["access_token"]

        res = client.put("/api/v1/users/me/password", json={
            "old_password": "wrongone",
            "new_password": "newpass456",
        }, headers=auth_headers(token))
        assert res.status_code == 400

    def test_get_roles(self, client, user_token):
        res = client.get("/api/v1/users/me/roles", headers=auth_headers(user_token))
        assert res.status_code == 200
        assert "roles" in res.json()
        assert len(res.json()["roles"]) >= 1

    def test_switch_to_invalid_role(self, client, user_token):
        res = client.put("/api/v1/users/me/current-role",
                         json={"role": "admin"},
                         headers=auth_headers(user_token))
        assert res.status_code == 400  # User doesn't have admin role

    def test_get_user_by_id_public(self, client, db):
        from app.models.user import User
        user = db.query(User).first()
        if user:
            res = client.get(f"/api/v1/users/{user.user_id}")
            assert res.status_code == 200


class TestShopRegistration:
    def test_register_shop(self, client):
        data = create_user_and_login(client, "shopregtest@test.com")
        token = data["access_token"]

        res = client.post("/api/v1/users/register-shop", json={
            "shop_name": "My Shop",
            "address": "123 My St",
            "description": "A test shop",
        }, headers=auth_headers(token))
        assert res.status_code == 201
        assert res.json()["status"] == "pending"

    def test_double_shop_registration(self, client):
        data = create_user_and_login(client, "doubleshop@test.com")
        token = data["access_token"]

        payload = {"shop_name": "Shop A", "address": "Street A"}
        client.post("/api/v1/users/register-shop", json=payload, headers=auth_headers(token))
        res = client.post("/api/v1/users/register-shop", json=payload, headers=auth_headers(token))
        assert res.status_code == 400

    def test_register_shipper(self, client):
        data = create_user_and_login(client, "shipperregtest@test.com")
        token = data["access_token"]

        res = client.post("/api/v1/users/register-shipper", json={
            "vehicle_type": "motorcycle",
            "license_plate": "51B-67890",
        }, headers=auth_headers(token))
        assert res.status_code == 201


class TestNotifications:
    def test_get_notifications(self, client, user_token):
        res = client.get("/api/v1/notifications", headers=auth_headers(user_token))
        assert res.status_code == 200
        data = res.json()
        assert "notifications" in data
        assert "unread_count" in data

    def test_mark_all_read(self, client, user_token):
        res = client.put("/api/v1/notifications/read-all", headers=auth_headers(user_token))
        assert res.status_code == 200
