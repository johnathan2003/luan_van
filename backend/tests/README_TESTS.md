# Hướng dẫn chạy Tests

## Cài đặt

```bash
cd backend
venv\Scripts\activate        # Windows
source venv/bin/activate     # Mac/Linux

pip install pytest pytest-asyncio httpx
```

## Chạy tất cả tests

```bash
pytest tests/ -v
```

## Chạy từng file

```bash
pytest tests/test_auth.py -v          # Auth tests
pytest tests/test_users.py -v         # User/Profile tests
pytest tests/test_products.py -v      # Product tests
pytest tests/test_orders.py -v        # Order/Cart tests
pytest tests/test_shop.py -v          # Shop management tests
pytest tests/test_admin.py -v         # Admin tests
```

## Chạy theo keyword

```bash
pytest tests/ -v -k "login"           # Chỉ test có "login" trong tên
pytest tests/ -v -k "admin"           # Chỉ admin tests
pytest tests/ -v -k "cart or order"   # Cart và order tests
```

## Xem coverage

```bash
pip install pytest-cov
pytest tests/ --cov=app --cov-report=html
# Mở htmlcov/index.html để xem báo cáo
```

## Lưu ý

- Tests dùng SQLite in-memory, **không** cần MySQL đang chạy
- Mỗi test session tạo DB mới, sau khi xong xóa
- Tests độc lập với nhau, có thể chạy theo thứ tự bất kỳ
- Nếu test fail, chạy `pytest tests/ -v -s` để xem log chi tiết
