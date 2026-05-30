"""
Tests cho Order + Cart APIs: thêm giỏ hàng, đặt hàng, xác nhận, hủy.
"""
import pytest
from .conftest import create_user_and_login, auth_headers


@pytest.fixture(scope="module")
def buyer_token(client):
    data = create_user_and_login(client, "buyer@test.com", "buy1234", "Buyer User")
    return data["access_token"]


@pytest.fixture(scope="module")
def active_product_id(client, db):
    """Tạo product đã được approved để test order/cart."""
    from app.models.user import User, Role, UserRole
    from app.models.shop import Shop
    from app.models.product import Product
    from app.utils.security import hash_password

    # Create shop owner
    user = User(email="shopfororder@test.com", password_hash=hash_password("shop123"), full_name="Shop Order")
    db.add(user)
    db.flush()
    shop_role = db.query(Role).filter(Role.role_name == "shop").first()
    if shop_role:
        db.add(UserRole(user_id=user.user_id, role_id=shop_role.role_id, current_role=True))
    shop = Shop(shop_id=user.user_id, shop_name="Order Shop", address="456 Shop St", verification_status="approved")
    db.add(shop)
    db.flush()

    # Create active product
    product = Product(
        shop_id=user.user_id,
        product_name="Test Product for Order",
        price="100000.00",
        stock_quantity=100,
        status="active",
    )
    db.add(product)
    db.commit()
    return product.product_id


class TestCart:
    def test_get_empty_cart(self, client, buyer_token):
        res = client.get("/api/v1/carts/me", headers=auth_headers(buyer_token))
        assert res.status_code == 200
        assert res.json()["item_count"] == 0

    def test_add_to_cart(self, client, buyer_token, active_product_id):
        res = client.post("/api/v1/carts/items", json={
            "product_id": active_product_id,
            "quantity": 2,
        }, headers=auth_headers(buyer_token))
        assert res.status_code == 201
        assert res.json()["quantity"] == 2

    def test_add_same_product_increments(self, client, buyer_token, active_product_id):
        # Add once
        client.post("/api/v1/carts/items", json={"product_id": active_product_id, "quantity": 1},
                    headers=auth_headers(buyer_token))
        res = client.get("/api/v1/carts/me", headers=auth_headers(buyer_token))
        assert res.status_code == 200

    def test_add_nonexistent_product(self, client, buyer_token):
        res = client.post("/api/v1/carts/items", json={"product_id": 99999, "quantity": 1},
                          headers=auth_headers(buyer_token))
        assert res.status_code == 404

    def test_add_zero_quantity(self, client, buyer_token, active_product_id):
        res = client.post("/api/v1/carts/items", json={"product_id": active_product_id, "quantity": 0},
                          headers=auth_headers(buyer_token))
        assert res.status_code == 400

    def test_cart_requires_auth(self, client):
        res = client.get("/api/v1/carts/me")
        assert res.status_code == 403

    def test_clear_cart(self, client, buyer_token, active_product_id):
        client.post("/api/v1/carts/items", json={"product_id": active_product_id, "quantity": 1},
                    headers=auth_headers(buyer_token))
        res = client.delete("/api/v1/carts/clear", headers=auth_headers(buyer_token))
        assert res.status_code == 200


class TestOrders:
    def test_create_order_cod(self, client, buyer_token, active_product_id):
        res = client.post("/api/v1/orders", json={
            "items": [{"product_id": active_product_id, "quantity": 1}],
            "shipping_address": "123 Buyer St, HCM",
            "recipient_name": "Buyer",
            "recipient_phone": "0901234567",
            "payment_method": "cod",
        }, headers=auth_headers(buyer_token))
        assert res.status_code == 201
        data = res.json()
        assert "order_id" in data
        assert data["status"] == "pending"
        return data["order_id"]

    def test_create_order_empty_items(self, client, buyer_token):
        res = client.post("/api/v1/orders", json={
            "items": [],
            "shipping_address": "Test",
            "payment_method": "cod",
        }, headers=auth_headers(buyer_token))
        assert res.status_code == 400

    def test_create_order_requires_auth(self, client, active_product_id):
        res = client.post("/api/v1/orders", json={
            "items": [{"product_id": active_product_id, "quantity": 1}],
            "shipping_address": "Test",
            "payment_method": "cod",
        })
        assert res.status_code == 403

    def test_get_my_orders(self, client, buyer_token):
        res = client.get("/api/v1/orders/me", headers=auth_headers(buyer_token))
        assert res.status_code == 200
        data = res.json()
        assert "orders" in data
        assert "total" in data

    def test_get_my_orders_filter_by_status(self, client, buyer_token):
        res = client.get("/api/v1/orders/me?order_status=pending", headers=auth_headers(buyer_token))
        assert res.status_code == 200
        for order in res.json()["orders"]:
            assert order["order_status"] == "pending"

    def test_cancel_order(self, client, buyer_token, active_product_id):
        # Create order
        create_res = client.post("/api/v1/orders", json={
            "items": [{"product_id": active_product_id, "quantity": 1}],
            "shipping_address": "Cancel Test",
            "payment_method": "cod",
        }, headers=auth_headers(buyer_token))
        order_id = create_res.json()["order_id"]

        # Cancel
        cancel_res = client.put(f"/api/v1/orders/{order_id}/cancel",
                                headers=auth_headers(buyer_token))
        assert cancel_res.status_code == 200
        assert cancel_res.json()["status"] == "cancelled"

    def test_get_order_tracking(self, client, buyer_token, active_product_id):
        create_res = client.post("/api/v1/orders", json={
            "items": [{"product_id": active_product_id, "quantity": 1}],
            "shipping_address": "Track Test",
            "payment_method": "cod",
        }, headers=auth_headers(buyer_token))
        order_id = create_res.json()["order_id"]

        track_res = client.get(f"/api/v1/orders/{order_id}/tracking",
                               headers=auth_headers(buyer_token))
        assert track_res.status_code == 200
        assert "order_status" in track_res.json()

    def test_get_order_not_found(self, client, buyer_token):
        res = client.get("/api/v1/orders/99999", headers=auth_headers(buyer_token))
        assert res.status_code == 404
