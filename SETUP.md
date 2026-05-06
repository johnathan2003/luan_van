# Shopee Clone — Hướng dẫn cài đặt và phát triển

## Cấu trúc project

```
shopee-clone/
├── backend/                  # Django
│   ├── config/               # Settings, URLs, ASGI, Celery
│   ├── apps/
│   │   ├── users/            # Auth, User model, Address
│   │   ├── shops/            # Shop model, review
│   │   ├── products/         # Product, Category, Review, AI trigger
│   │   ├── orders/           # Cart, Order, OrderItem + Service layer
│   │   ├── payments/         # Payment gateway tích hợp
│   │   ├── delivery/         # Shipper, GPS tracking, WebSocket consumer
│   │   ├── inventory/        # Tồn kho, reserved stock, log
│   │   ├── notifications/    # Notification model + Celery tasks
│   │   ├── analytics/        # Dashboard seller + admin
│   │   └── ai_services/      # AI moderation + recommendation
│   └── core/
│       ├── permissions/      # IsBuyer, IsSeller, IsShipper, IsAdmin...
│       ├── middleware/       # Request logging
│       └── utils/            # Pagination
├── frontend/                 # React
│   └── src/
│       ├── services/api/     # Axios instance + tất cả API calls
│       ├── hooks/            # useWebSocket (tracking, notifications)
│       ├── store/            # Zustand stores (auth, cart...)
│       └── pages/            # buyer/, seller/, shipper/, admin/
└── docker-compose.yml
```

---

## Cài đặt local (không dùng Docker)

### 1. Backend

```bash
cd backend

# Tạo virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Cài packages
pip install -r requirements/base.txt

# Tạo file .env
cp .env.example .env
# Mở .env và điền thông tin database, redis...

# Tạo database PostgreSQL
createdb shopee_clone

# Migrate
python manage.py migrate

# Tạo superuser (admin)
python manage.py createsuperuser

# Chạy server
python manage.py runserver
```

### 2. Celery (terminal riêng)

```bash
cd backend
source venv/bin/activate

# Worker
celery -A config worker -l info

# Beat scheduler (terminal riêng nữa)
celery -A config beat -l info
```

### 3. Frontend

```bash
cd frontend
npm install
npm start
```

---

## Cài đặt với Docker (khuyến nghị)

```bash
# Copy env
cp backend/.env.example backend/.env

# Build & run tất cả
docker-compose up --build

# Chạy migrate (lần đầu)
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py createsuperuser
```

---

## API Docs

Sau khi chạy backend, truy cập:
- Swagger UI: http://localhost:8000/api/docs/
- Admin: http://localhost:8000/admin/

---

## Thứ tự phát triển (một mình)

### Giai đoạn 1 — MVP (làm trước)
- [ ] `apps/users` — Auth + User model xong
- [ ] `apps/shops` — Shop model + CRUD
- [ ] `apps/products` — Product + Category + Inventory cơ bản
- [ ] `apps/orders` — Cart + Order flow + OrderService
- [ ] Frontend: Login/Register, trang sản phẩm, giỏ hàng, đặt hàng

### Giai đoạn 2
- [ ] `apps/delivery` — Shipper nhận đơn, cập nhật trạng thái
- [ ] `apps/analytics` — Seller dashboard
- [ ] `apps/notifications` — Celery tasks
- [ ] AI moderation rule-based
- [ ] Frontend: Seller dashboard, Shipper app

### Giai đoạn 3
- [ ] WebSocket tracking (Django Channels)
- [ ] AI recommendation thật (collaborative filtering)
- [ ] Admin panel
- [ ] Payment gateway tích hợp

---

## Lưu ý quan trọng

### Inventory (tránh oversell)
File `apps/orders/services.py` → `OrderService.create_order()` dùng
`select_for_update()` để lock DB row khi đặt hàng. **Không bỏ qua điều này.**

### WebSocket
Phải dùng `daphne` hoặc `uvicorn` thay cho `runserver` ở production:
```bash
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

### AI moderation
Hiện tại là rule-based đơn giản. Để upgrade lên AI thật,
sửa file `apps/ai_services/tasks.py` → `moderate_product()`.

### Secrets
**Không bao giờ commit file `.env` lên git.**
Thêm `.env` vào `.gitignore` ngay.
