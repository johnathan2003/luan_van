"""
Tests cho Product APIs: CRUD, approval, categories, deletion request.
"""
import pytest
from .conftest import create_user_and_login, auth_headers


@pytest.fixture(scope="module")
def shop_token(client, db):
    """Tạo shop owner user với role shop."""
    from app.models.user import User, Role, UserRole
    from app.models.shop import Shop
    from app.utils.security import hash_password

    email = "shopowner@test.com"
    existing = db.query(User).filter(User.email == email).first()
    if not existing:
        user = User(email=email, password_hash=hash_password("shop1234"), full_name="Shop Owner")
        db.add(user)
        db.flush()
        shop_role = db.query(Role).filter(Role.role_name == "shop").first()
        if shop_role:
            db.add(UserRole(user_id=user.user_id, role_id=shop_role.role_id, current_role=True))
        shop = Shop(shop_id=user.user_id, shop_name="Test Shop", address="123 Test St", verification_status="approved")
        db.add(shop)
        db.commit()

    res = client.post("/api/v1/auth/login", json={"email": email, "password": "shop1234"})
    return res.json()["access_token"]


class TestCategories:
    def test_create_category(self, client):
        res = client.post("/api/v1/products/categories", json={
            "category_name": "Electronics",
            "description": "Electronic goods",
        })
        assert res.status_code == 201
        assert res.json()["category_id"] is not None

    def test_list_categories(self, client):
        res = client.get("/api/v1/products/categories")
        assert res.status_code == 200
        assert "categories" in res.json()

    def test_duplicate_category(self, client):
        client.post("/api/v1/products/categories", json={"category_name": "UniqueCategory"})
        res = client.post("/api/v1/products/categories", json={"category_name": "UniqueCategory"})
        assert res.status_code in (400, 422, 500)


class TestProductCRUD:
    def test_list_products_public(self, client):
        res = client.get("/api/v1/products")
        assert res.status_code == 200
        data = res.json()
        assert "products" in data
        assert "total" in data
        assert "page" in data

    def test_list_products_with_filters(self, client):
        res = client.get("/api/v1/products?page=1&limit=5&sort=newest")
        assert res.status_code == 200

    def test_create_product_requires_auth(self, client):
        res = client.post("/api/v1/products", json={"product_name": "Test", "price": 100, "stock_quantity": 10})
        assert res.status_code == 403

    def test_create_product_as_shop(self, client, shop_token):
        res = client.post("/api/v1/products", json={
            "product_name": "iPhone 15",
            "description": "Latest iPhone",
            "price": 25000000,
            "stock_quantity": 50,
        }, headers=auth_headers(shop_token))
        assert res.status_code == 201
        data = res.json()
        assert data["product_id"] is not None
        assert data["status"] == "pending"  # Chờ duyệt
        return data["product_id"]

    def test_create_product_negative_price(self, client, shop_token):
        res = client.post("/api/v1/products", json={
            "product_name": "Negative",
            "price": -100,
            "stock_quantity": 5,
        }, headers=auth_headers(shop_token))
        assert res.status_code == 422

    def test_create_product_zero_price(self, client, shop_token):
        res = client.post("/api/v1/products", json={
            "product_name": "Zero Price",
            "price": 0,
            "stock_quantity": 5,
        }, headers=auth_headers(shop_token))
        assert res.status_code == 422

    def test_get_product_not_found(self, client):
        res = client.get("/api/v1/products/99999")
        assert res.status_code == 404


class TestProductApproval:
    def test_approve_product_as_admin(self, client, admin_token, shop_token, db):
        # Tạo sản phẩm
        create_res = client.post("/api/v1/products", json={
            "product_name": "To Approve",
            "price": 500000,
            "stock_quantity": 20,
        }, headers=auth_headers(shop_token))
        product_id = create_res.json()["product_id"]

        # Admin duyệt
        approve_res = client.put(f"/api/v1/admin/products/{product_id}/approve",
                                 headers=auth_headers(admin_token))
        assert approve_res.status_code == 200

        # Kiểm tra status
        from app.models.product import Product
        product = db.query(Product).filter(Product.product_id == product_id).first()
        assert product.status == "active"

    def test_reject_product_as_admin(self, client, admin_token, shop_token):
        create_res = client.post("/api/v1/products", json={
            "product_name": "To Reject",
            "price": 100000,
            "stock_quantity": 5,
        }, headers=auth_headers(shop_token))
        product_id = create_res.json()["product_id"]

        reject_res = client.put(f"/api/v1/admin/products/{product_id}/reject",
                                json={"reason": "Hình ảnh không đạt yêu cầu"},
                                headers=auth_headers(admin_token))
        assert reject_res.status_code == 200

    def test_approve_product_requires_admin(self, client, user_token):
        res = client.put("/api/v1/admin/products/1/approve", headers=auth_headers(user_token))
        assert res.status_code == 403


class TestShopProducts:
    def test_shop_own_product_list(self, client, shop_token):
        res = client.get("/api/v1/shop/products", headers=auth_headers(shop_token))
        assert res.status_code == 200
        assert "products" in res.json()

    def test_update_product(self, client, shop_token):
        create_res = client.post("/api/v1/products", json={
            "product_name": "Update Me",
            "price": 100000,
            "stock_quantity": 10,
        }, headers=auth_headers(shop_token))
        pid = create_res.json()["product_id"]

        update_res = client.put(f"/api/v1/products/{pid}", json={
            "product_name": "Updated Name",
            "stock_quantity": 999,
        }, headers=auth_headers(shop_token))
        assert update_res.status_code == 200
