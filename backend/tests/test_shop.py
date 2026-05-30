"""
Tests cho Shop APIs: shop info, employees, vouchers, analytics.
"""
import pytest
from .conftest import auth_headers, create_user_and_login


@pytest.fixture(scope="module")
def shop_data(client, db):
    """Tạo shop owner đã được approved."""
    from app.models.user import User, Role, UserRole
    from app.models.shop import Shop
    from app.utils.security import hash_password

    email = "shoptest@test.com"
    existing = db.query(User).filter(User.email == email).first()
    if not existing:
        user = User(email=email, password_hash=hash_password("shop5678"), full_name="Shop Test Owner")
        db.add(user)
        db.flush()
        role = db.query(Role).filter(Role.role_name == "shop").first()
        if role:
            db.add(UserRole(user_id=user.user_id, role_id=role.role_id, current_role=True))
        shop = Shop(
            shop_id=user.user_id,
            shop_name="My Test Shop",
            address="789 Shop Ave",
            verification_status="approved",
        )
        db.add(shop)
        db.commit()
        db.refresh(user)

    res = client.post("/api/v1/auth/login", json={"email": email, "password": "shop5678"})
    token = res.json()["access_token"]
    return {"token": token}


class TestShopInfo:
    def test_get_my_shop(self, client, shop_data):
        res = client.get("/api/v1/shop/me", headers=auth_headers(shop_data["token"]))
        assert res.status_code == 200
        data = res.json()
        assert data["shop_name"] == "My Test Shop"
        assert data["verification_status"] == "approved"

    def test_update_shop(self, client, shop_data):
        res = client.put("/api/v1/shop/me", json={
            "shop_name": "Updated Shop Name",
            "description": "Best shop in town",
        }, headers=auth_headers(shop_data["token"]))
        assert res.status_code == 200
        assert res.json()["message"] == "Shop updated"

    def test_shop_requires_auth(self, client):
        res = client.get("/api/v1/shop/me")
        assert res.status_code == 403

    def test_shop_requires_shop_role(self, client):
        data = create_user_and_login(client, "notshop@test.com")
        res = client.get("/api/v1/shop/me", headers=auth_headers(data["access_token"]))
        assert res.status_code == 403


class TestShopAnalytics:
    def test_get_analytics(self, client, shop_data):
        res = client.get("/api/v1/shop/analytics", headers=auth_headers(shop_data["token"]))
        assert res.status_code == 200
        data = res.json()
        assert "total_revenue" in data
        assert "total_orders" in data
        assert "total_products" in data
        assert "top_products" in data

    def test_get_analytics_custom_days(self, client, shop_data):
        res = client.get("/api/v1/shop/analytics?days=7", headers=auth_headers(shop_data["token"]))
        assert res.status_code == 200


class TestShopOrders:
    def test_get_shop_orders(self, client, shop_data):
        res = client.get("/api/v1/shop/orders", headers=auth_headers(shop_data["token"]))
        assert res.status_code == 200
        assert "orders" in res.json()

    def test_get_shop_orders_by_status(self, client, shop_data):
        res = client.get("/api/v1/shop/orders?order_status=pending",
                         headers=auth_headers(shop_data["token"]))
        assert res.status_code == 200


class TestShopEmployees:
    def test_list_employees_empty(self, client, shop_data):
        res = client.get("/api/v1/shop/employees", headers=auth_headers(shop_data["token"]))
        assert res.status_code == 200
        assert "employees" in res.json()

    def test_add_employee(self, client, shop_data):
        res = client.post("/api/v1/shop/employees", json={
            "employee_email": "emp1@test.com",
            "employee_name": "Employee One",
            "position": "Sales",
            "permissions": ["order:confirm", "order:read"],
        }, headers=auth_headers(shop_data["token"]))
        assert res.status_code == 201
        assert "employee_id" in res.json()
        return res.json()["employee_id"]


class TestVouchers:
    def test_create_voucher(self, client, shop_data):
        res = client.post("/api/v1/shop/vouchers", json={
            "code": "TESTCODE10",
            "discount_type": "percentage",
            "discount_value": 10,
            "min_order_value": 100000,
            "max_uses": 50,
        }, headers=auth_headers(shop_data["token"]))
        assert res.status_code == 201
        assert res.json()["voucher_id"] is not None

    def test_create_voucher_duplicate_code(self, client, shop_data):
        client.post("/api/v1/shop/vouchers", json={
            "code": "DUPCODE",
            "discount_type": "fixed",
            "discount_value": 5000,
        }, headers=auth_headers(shop_data["token"]))
        res = client.post("/api/v1/shop/vouchers", json={
            "code": "DUPCODE",
            "discount_type": "fixed",
            "discount_value": 5000,
        }, headers=auth_headers(shop_data["token"]))
        assert res.status_code == 400

    def test_list_vouchers(self, client, shop_data):
        res = client.get("/api/v1/shop/vouchers", headers=auth_headers(shop_data["token"]))
        assert res.status_code == 200
        assert "vouchers" in res.json()
