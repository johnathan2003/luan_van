# Quy Trình 3 Bước Trước Khi Deploy

**Stack:** FastAPI + SQLAlchemy + Alembic → Render | React + Vite → Vercel | DB: Supabase PostgreSQL

---

## BƯỚC 1 — Kiểm Tra Code & Môi Trường

> **Mục tiêu:** Đảm bảo code sạch, env vars đầy đủ, không có lỗi syntax/import.

### 1.1 Chạy kiểm tra cơ bản

```bash
cd backend

# Kiểm tra cú pháp Python (không cần chạy server)
python -m py_compile app/main.py app/config.py app/database.py

# Kiểm tra import không bị vỡ
python -c "from app.main import app; print('✅ Import OK')"

# Kiểm tra config load đúng
python -c "from app.config import settings; print('ENV:', settings.ENVIRONMENT, '| DEBUG:', settings.DEBUG)"
```

### 1.2 Kiểm tra file .env

```bash
# Các biến BẮT BUỘC phải có giá trị (không được để trống)
python -c "
from app.config import settings
required = {
    'DB_HOST': settings.DB_HOST,
    'DB_USER': settings.DB_USER,
    'DB_PASSWORD': settings.DB_PASSWORD,
    'SECRET_KEY': settings.SECRET_KEY,
    'SUPABASE_URL': settings.SUPABASE_URL,
    'SUPABASE_SERVICE_KEY': settings.SUPABASE_SERVICE_KEY,
}
missing = [k for k, v in required.items() if not v or v in ('your-super-secret-key', 'password')]
if missing:
    print('❌ THIẾU hoặc chưa đổi:', missing)
else:
    print('✅ Env vars OK')
"
```

### 1.3 Kiểm tra kết nối Database

```bash
python -c "
from app.database import engine
from sqlalchemy import text
with engine.connect() as conn:
    result = conn.execute(text('SELECT version()'))
    print('✅ DB connected:', result.scalar()[:30])
"
```

### 1.4 Kiểm tra Frontend build không lỗi

```bash
cd frontend
npm run build 2>&1 | tail -5
# Kết quả mong đợi: "built in X.Xs" — KHÔNG có "error"
```

**✅ Điều kiện qua Bước 1:**
- [ ] Import OK, không lỗi syntax
- [ ] Tất cả env vars bắt buộc có giá trị thật
- [ ] Kết nối được Supabase DB
- [ ] Frontend build thành công

---

## BƯỚC 2 — Kiểm Tra Migration & Dữ Liệu

> **Mục tiêu:** Schema DB đồng bộ với code, không có migration còn pending.

### 2.1 Kiểm tra trạng thái migration

```bash
cd backend

# Xem migration hiện tại của DB
alembic current

# Xem có migration nào chưa apply chưa
alembic history --verbose | head -20
```

**Kết quả mong đợi:** `alembic current` hiển thị revision mới nhất với `(head)`.

Nếu **không** có `(head)`:

```bash
# Apply migration còn thiếu
alembic upgrade head

# Kiểm tra lại
alembic current
# → phải thấy (head)
```

### 2.2 Kiểm tra bảng tồn tại

```bash
python -c "
from app.database import engine
from sqlalchemy import inspect
inspector = inspect(engine)
tables = inspector.get_table_names()
required = ['users', 'shops', 'products', 'orders', 'order_items', 'payments', 'shipments', 'notifications']
missing = [t for t in required if t not in tables]
if missing:
    print('❌ Bảng chưa tồn tại:', missing)
else:
    print('✅ Tất cả', len(required), 'bảng OK. Tổng DB:', len(tables), 'bảng')
"
```

### 2.3 Kiểm tra seed data (nếu cần cho demo)

```bash
python -c "
from app.database import SessionLocal
from app.models.product import User
db = SessionLocal()
count = db.query(User).count()
db.close()
print('✅ Users:', count, '(cần >= 5 cho demo)' if count >= 5 else '❌ Thiếu — chạy: python seed.py')
"
```

Nếu DB trống:

```bash
python seed.py
# Expected: 6 users, 2 shops, 8 products, 5 orders...
```

**✅ Điều kiện qua Bước 2:**
- [ ] `alembic current` hiển thị `(head)`
- [ ] Tất cả bảng cần thiết tồn tại
- [ ] Có dữ liệu seed (nếu deploy cho demo)

---

## BƯỚC 3 — Deploy & Verify

> **Mục tiêu:** Push code, trigger deploy, xác nhận service healthy.

### 3.1 Commit & Push

```bash
# Từ root project
git status  # Kiểm tra file đã thay đổi

git add .
git commit -m "deploy: pre-deploy checklist passed - $(date '+%Y-%m-%d')"
git push origin main
```

### 3.2 Theo dõi deploy trên Render

1. Vào [Render Dashboard](https://dashboard.render.com) → chọn service backend
2. Tab **Logs** — chờ xuất hiện:
   ```
   Starting E-Commerce API [production]...
   Database tables verified  ← chỉ khi DEBUG=True
   Supabase Storage enabled (production mode).
   ```
3. Đợi status chuyển sang **Live** (thường 2–5 phút)

### 3.3 Verify sau deploy

```bash
# Thay YOUR-APP bằng subdomain Render của bạn
BASE_URL="https://YOUR-APP.onrender.com"

# Health check
curl -s "$BASE_URL/health" | python -m json.tool
# Kết quả mong đợi: {"status": "healthy", "environment": "production", ...}

# Kiểm tra auth hoạt động
curl -s -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@123"}' \
  | python -m json.tool | grep "access_token"
# Kết quả mong đợi: "access_token": "eyJ..."
```

### 3.4 Verify Frontend (Vercel)

```bash
FRONTEND_URL="https://YOUR-APP.vercel.app"

# Trang chủ load được
curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL"
# Kết quả mong đợi: 200
```

### 3.5 Kiểm tra Logs sau deploy

Render Dashboard → **Logs** — đảm bảo:
- ✅ Không có `ERROR` hay `Traceback` khi khởi động
- ✅ Request đầu tiên log đúng format: `GET /health - 200 - 0.XXXs`
- ✅ File log tạo được tại `logs/app.log` (nếu `LOG_FILE` được set)

**✅ Điều kiện qua Bước 3:**
- [ ] Render status = **Live**, không có lỗi startup
- [ ] `GET /health` trả về `{"status": "healthy"}`
- [ ] Login admin thành công, nhận được `access_token`
- [ ] Frontend load HTTP 200
- [ ] Không có ERROR trong logs 5 phút đầu

---

## Tóm Tắt Nhanh

| Bước | Kiểm tra gì | Thời gian ước tính |
|------|------------|-------------------|
| 1 — Code & Env | Import OK, env vars, DB connect, FE build | ~5 phút |
| 2 — Migration & Data | Schema đồng bộ, bảng tồn tại, seed data | ~5 phút |
| 3 — Deploy & Verify | Push, Render live, health check, auth check | ~10 phút |

**Tổng: ~20 phút** trước mỗi lần deploy.

---

## Rollback Nhanh (nếu có sự cố)

```bash
# Xem commit trước
git log --oneline -5

# Rollback về commit ổn định
git revert HEAD
git push origin main
# → Render sẽ tự deploy lại bản cũ
```
