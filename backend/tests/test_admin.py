"""
Tests cho Admin APIs: user management, approvals, disputes, system employees.
"""
import pytest
from .conftest import auth_headers, create_user_and_login


class TestAdminAuth:
    def test_admin_dashboard_requires_admin(self, client, user_token):
        res = client.get("/api/v1/admin/dashboard", headers=auth_headers(user_token))
        assert res.status_code == 403

    def test_admin_dashboard_with_admin_token(self, client, admin_token):
        res = client.get("/api/v1/admin/dashboard", headers=auth_headers(admin_token))
        assert res.status_code == 200
        data = res.json()
        assert "total_users" in data
        assert "total_shops" in data
        assert "total_orders" in data
        assert "pending_shop_registrations" in data
        assert "open_disputes" in data


class TestAdminUsers:
    def test_list_users(self, client, admin_token):
        res = client.get("/api/v1/admin/users", headers=auth_headers(admin_token))
        assert res.status_code == 200
        data = res.json()
        assert "users" in data
        assert "total" in data
        assert len(data["users"]) > 0  # At least admin exists

    def test_ban_user(self, client, admin_token, db):
        # Create target user
        target = create_user_and_login(client, "tobanned@test.com")
        from app.models.user import User
        user = db.query(User).filter(User.email == "tobanned@test.com").first()
        user_id = user.user_id

        res = client.put(f"/api/v1/admin/users/{user_id}/ban", headers=auth_headers(admin_token))
        assert res.status_code == 200

        # Verify banned
        db.refresh(user)
        assert user.status == "banned"

    def test_unban_user(self, client, admin_token, db):
        from app.models.user import User
        user = db.query(User).filter(User.email == "tobanned@test.com").first()
        if user:
            user_id = user.user_id
            client.put(f"/api/v1/admin/users/{user_id}/ban", headers=auth_headers(admin_token))
            res = client.put(f"/api/v1/admin/users/{user_id}/unban", headers=auth_headers(admin_token))
            assert res.status_code == 200
            db.refresh(user)
            assert user.status == "active"

    def test_ban_nonexistent_user(self, client, admin_token):
        res = client.put("/api/v1/admin/users/99999/ban", headers=auth_headers(admin_token))
        assert res.status_code == 404


class TestShopRegistrationApproval:
    def test_list_pending_shop_registrations(self, client, admin_token):
        res = client.get("/api/v1/admin/shop-registrations?status=pending",
                         headers=auth_headers(admin_token))
        assert res.status_code == 200
        assert "registrations" in res.json()

    def test_submit_and_approve_shop(self, client, admin_token):
        # Create user and submit shop registration
        user_data = create_user_and_login(client, "shopapply@test.com")
        token = user_data["access_token"]

        reg_res = client.post("/api/v1/users/register-shop", json={
            "shop_name": "Approval Test Shop",
            "address": "999 Approval St",
            "description": "Test shop for approval",
        }, headers=auth_headers(token))
        assert reg_res.status_code == 201
        reg_id = reg_res.json()["reg_id"]

        # Admin approves
        approve_res = client.put(f"/api/v1/admin/shop-registrations/{reg_id}/approve",
                                 headers=auth_headers(admin_token))
        assert approve_res.status_code == 200
        assert "shop_id" in approve_res.json()

    def test_reject_shop_registration(self, client, admin_token):
        user_data = create_user_and_login(client, "shopreject@test.com")
        token = user_data["access_token"]

        reg_res = client.post("/api/v1/users/register-shop", json={
            "shop_name": "Reject Test Shop",
            "address": "111 Reject St",
        }, headers=auth_headers(token))
        reg_id = reg_res.json()["reg_id"]

        reject_res = client.put(f"/api/v1/admin/shop-registrations/{reg_id}/reject",
                                json={"reason": "Thiếu giấy tờ"},
                                headers=auth_headers(admin_token))
        assert reject_res.status_code == 200


class TestShipperRegistrationApproval:
    def test_submit_and_approve_shipper(self, client, admin_token):
        user_data = create_user_and_login(client, "shippertest@test.com")
        token = user_data["access_token"]

        reg_res = client.post("/api/v1/users/register-shipper", json={
            "vehicle_type": "motorcycle",
            "license_plate": "51A-12345",
        }, headers=auth_headers(token))
        assert reg_res.status_code == 201
        reg_id = reg_res.json()["reg_id"]

        approve_res = client.put(f"/api/v1/admin/shipper-registrations/{reg_id}/approve",
                                 headers=auth_headers(admin_token))
        assert approve_res.status_code == 200


class TestPendingProducts:
    def test_list_pending_products(self, client, admin_token):
        res = client.get("/api/v1/admin/products/pending", headers=auth_headers(admin_token))
        assert res.status_code == 200
        assert "products" in res.json()


class TestSystemEmployees:
    def test_create_system_employee(self, client, admin_token):
        res = client.post("/api/v1/admin/system-employees", json={
            "employee_email": "sysempl@test.com",
            "employee_name": "System Emp",
            "role_name": "product_manager",
            "permissions": ["product:approve", "product:read"],
        }, headers=auth_headers(admin_token))
        assert res.status_code == 201
        assert "emp_id" in res.json()

    def test_list_system_employees(self, client, admin_token):
        res = client.get("/api/v1/admin/system-employees", headers=auth_headers(admin_token))
        assert res.status_code == 200
        assert "employees" in res.json()


class TestAdminLogs:
    def test_get_admin_logs(self, client, admin_token):
        res = client.get("/api/v1/admin/logs", headers=auth_headers(admin_token))
        assert res.status_code == 200
        assert "logs" in res.json()
