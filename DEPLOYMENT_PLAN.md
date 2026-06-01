# 🚀 Kế Hoạch Triển Khai - E-Commerce Platform
> Stack: FastAPI (Python) + React (TypeScript) + Supabase (PostgreSQL) + Vercel

---

## ⚠️ Phân Tích Vấn Đề Hiện Tại

Trước khi triển khai, cần giải quyết **4 điểm mâu thuẫn** trong codebase:

| Vấn đề | Hiện tại | Cần đổi |
|--------|----------|---------|
| Database driver | `pymysql` (MySQL) | `psycopg2` (PostgreSQL) |
| DATABASE_URL | `mysql+pymysql://...` | `postgresql+psycopg2://...` |
| File uploads | Local filesystem (`uploads/`) | Supabase Storage |
| Redis | Local Redis | Upstash Redis (serverless) |

> **Lưu ý quan trọng:** Vercel **không thể** host FastAPI + Socket.io (vì serverless không hỗ trợ persistent WebSocket connection). Backend phải deploy trên **Railway** hoặc **Render**.

---

## 🏗️ Kiến Trúc Triển Khai Mục Tiêu

```
[User Browser]
      │
      ├──► Vercel (Frontend - React/Vite)
      │         │ HTTPS API calls
      │         ▼
      └──► Railway / Render (Backend - FastAPI + Socket.io)
                │
                ├──► Supabase (PostgreSQL Database)
                ├──► Supabase Storage (File uploads)
                └──► Upstash Redis (WebSocket/Cache)
```

---

## 📋 Giai Đoạn 1 — Database Setup (Supabase + Prisma)

**Mục tiêu:** Tạo toàn bộ schema + seed dữ liệu mẫu trên Supabase

### Các bước thực hiện

**1.1 Tạo Supabase project**
- Đăng nhập [supabase.com](https://supabase.com) → New Project
- Chọn region gần nhất (Singapore)
- Lưu lại: `Project URL`, `anon key`, `service_role key`, `Database password`

**1.2 Cấu hình Prisma kết nối Supabase**

Cập nhật `prisma/schema.prisma`:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

Cập nhật file `.env` ở root:
```env
# Connection pooling (dùng cho runtime)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection (dùng cho migrations)
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
```

**1.3 Push schema lên Supabase**
```bash
npx prisma db push
```

**1.4 Chạy seed dữ liệu**
```bash
npm run seed:tsx
```

### ✅ Test & Kết quả mong đợi

| Test | Cách kiểm tra | Kết quả mong đợi |
|------|--------------|-----------------|
| Tables tạo thành công | Supabase Dashboard → Table Editor | 25+ bảng được tạo |
| Seed data | Query `SELECT count(*) FROM users` | ≥ 10 users |
| Roles & Permissions | Query `SELECT * FROM roles` | 4 roles: admin, buyer, seller, shipper |
| Admin account | Query `SELECT email FROM users WHERE...` | admin@example.com tồn tại |
| Products & Shops | Query `SELECT count(*) FROM products` | ≥ 20 sản phẩm |

**Lệnh verify nhanh:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' ORDER BY table_name;
```

---

## 📋 Giai Đoạn 2 — Backend Refactor (MySQL → PostgreSQL)

**Mục tiêu:** Chuyển backend FastAPI từ MySQL sang PostgreSQL (Supabase)

### Các bước thực hiện

**2.1 Cập nhật dependencies**

Trong `backend/requirements.txt`, thay:
```
# XÓA:
pymysql==1.1.0
cryptography==41.0.7

# THÊM:
psycopg2-binary==2.9.9
```

**2.2 Cập nhật `backend/app/config.py`**

```python
# Thay DATABASE_URL property:
@property
def DATABASE_URL(self) -> str:
    return f"postgresql+psycopg2://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

# Thêm field DB_PORT default = 5432:
DB_PORT: int = 5432
```

**2.3 Cập nhật `backend/app/database.py`**

```python
# Xóa pool_recycle (MySQL specific), giữ lại:
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=settings.DEBUG,
)
```

**2.4 Tạo `backend/.env` cho Supabase**

```env
DB_HOST=aws-0-ap-southeast-1.pooler.supabase.com
DB_PORT=5432
DB_USER=postgres.[project-ref]
DB_PASSWORD=your-db-password
DB_NAME=postgres
SECRET_KEY=your-super-secret-key-change-in-production
ENVIRONMENT=production
DEBUG=False
FRONTEND_URL=https://your-app.vercel.app
ALLOWED_ORIGINS=https://your-app.vercel.app
```

**2.5 Cập nhật File Upload → Supabase Storage**

Trong `backend/app/utils/upload_service.py`, thay local file save bằng Supabase Storage SDK:
```python
from supabase import create_client
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

# Upload file:
response = supabase.storage.from_("uploads").upload(path, file_bytes)
# Lấy URL:
public_url = supabase.storage.from_("uploads").get_public_url(path)
```

Thêm vào `backend/app/config.py`:
```python
SUPABASE_URL: str = ""
SUPABASE_SERVICE_KEY: str = ""
```

**2.6 Cập nhật Redis → Upstash**

Tạo account tại [upstash.com](https://upstash.com) → Redis → Create Database.
Lấy `REDIS_URL` (format: `rediss://...`) và cập nhật `.env`.

### ✅ Test & Kết quả mong đợi

```bash
# Chạy backend local với Supabase DB:
cd backend
uvicorn app.main:socket_app --reload

# Test health check:
curl http://localhost:8000/health
# → {"status": "healthy", "environment": "development"}

# Test API docs:
# Mở http://localhost:8000/docs
```

| Test | Endpoint | Kết quả mong đợi |
|------|----------|-----------------|
| Health check | `GET /health` | `{"status": "healthy"}` |
| Register | `POST /api/v1/auth/register` | User tạo thành công |
| Login | `POST /api/v1/auth/login` | Trả về JWT token |
| Get products | `GET /api/v1/products` | List sản phẩm từ Supabase |
| File upload | `POST /api/v1/users/avatar` | URL Supabase Storage |

---

## 📋 Giai Đoạn 3 — Deploy Backend (Railway)

**Mục tiêu:** Đưa FastAPI backend lên production

### Lý do chọn Railway thay Vercel cho backend
- Hỗ trợ persistent server (cần cho Socket.io)
- Hỗ trợ Python/Docker natively
- Free tier $5/tháng credit
- Deploy từ GitHub repo

### Các bước thực hiện

**3.1 Tạo `backend/Dockerfile`** (nếu chưa có hoặc cần update)
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:socket_app", "--host", "0.0.0.0", "--port", "8000"]
```

**3.2 Deploy lên Railway**
```bash
# Cài Railway CLI:
npm install -g @railway/cli

# Login và deploy:
railway login
cd backend
railway init
railway up
```

**3.3 Set environment variables trên Railway**
- Vào Railway dashboard → Variables
- Copy toàn bộ `.env` production vào đây
- Đặc biệt: `DB_HOST`, `DB_PASSWORD`, `SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `REDIS_URL`

**3.4 Lấy deployed URL từ Railway**
- Ví dụ: `https://your-backend.up.railway.app`

### ✅ Test & Kết quả mong đợi

| Test | Cách kiểm tra | Kết quả mong đợi |
|------|--------------|-----------------|
| Server online | `GET https://your-backend.up.railway.app/` | `{"status": "running"}` |
| DB connection | `GET /health` | `{"status": "healthy", "environment": "production"}` |
| CORS | Request từ localhost:5173 | Không bị CORS error |
| WebSocket | Kết nối Socket.io từ frontend | Connected event |
| Auth API | `POST /api/v1/auth/login` | JWT token hợp lệ |

---

## 📋 Giai Đoạn 4 — Deploy Frontend (Vercel)

**Mục tiêu:** Deploy React app lên Vercel, kết nối với backend Railway

### Các bước thực hiện

**4.1 Kiểm tra `frontend/package.json`**

Đảm bảo có build script và đúng framework (Vite):
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

**4.2 Tạo `frontend/.env.production`**
```env
VITE_API_URL=https://your-backend.up.railway.app
VITE_SUPABASE_URL=https://[project-ref].supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**4.3 Kiểm tra API base URL trong frontend**

Trong `frontend/src/services/api.ts`:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
```

**4.4 Deploy lên Vercel**
```bash
# Cài Vercel CLI:
npm install -g vercel

cd frontend
vercel

# Hoặc kết nối GitHub repo trên vercel.com → Import Project → frontend/
```

**4.5 Cấu hình Vercel**
- Framework Preset: Vite
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variables: thêm `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### ✅ Test & Kết quả mong đợi

| Test | Cách kiểm tra | Kết quả mong đợi |
|------|--------------|-----------------|
| Build thành công | Vercel dashboard → Deployments | Build status: Ready |
| Trang chủ load | Mở `https://your-app.vercel.app` | Hiển thị HomePage |
| Login flow | Đăng nhập với admin account | Redirect đến admin dashboard |
| API calls | Network tab browser | Requests đến Railway backend |
| No CORS errors | Browser console | Không có CORS error |

---

## 📋 Giai Đoạn 5 — Integration Testing (End-to-End)

**Mục tiêu:** Kiểm tra toàn bộ luồng nghiệp vụ trên production

### 5.1 Luồng Buyer

| # | Hành động | Kết quả mong đợi |
|---|-----------|-----------------|
| 1 | Đăng ký tài khoản buyer | Tạo thành công, nhận email |
| 2 | Đăng nhập | JWT token, redirect Home |
| 3 | Browse sản phẩm | Hiển thị danh sách products |
| 4 | Xem chi tiết sản phẩm | Hiển thị ảnh, giá, mô tả |
| 5 | Thêm vào giỏ hàng | Cart count tăng |
| 6 | Checkout → COD | Order tạo, status = PENDING |
| 7 | Xem lịch sử đơn hàng | Hiển thị đơn vừa tạo |

### 5.2 Luồng Seller (Shop)

| # | Hành động | Kết quả mong đợi |
|---|-----------|-----------------|
| 1 | Đăng ký shop | ShopRegistration tạo, status = PENDING |
| 2 | Admin duyệt shop | status = APPROVED, shop được tạo |
| 3 | Thêm sản phẩm | Product tạo, status = PENDING |
| 4 | Quản lý đơn hàng | Hiển thị orders của shop |
| 5 | Xác nhận đơn hàng | Order status → CONFIRMED |

### 5.3 Luồng Admin

| # | Hành động | Kết quả mong đợi |
|---|-----------|-----------------|
| 1 | Đăng nhập admin | Redirect Admin Dashboard |
| 2 | Duyệt shop registration | Shop status PENDING → APPROVED |
| 3 | Duyệt shipper registration | Shipper được tạo |
| 4 | Xem audit logs | Hiển thị admin log |
| 5 | Resolve dispute | Dispute status → RESOLVED |

### 5.4 Luồng Shipper

| # | Hành động | Kết quả mong đợi |
|---|-----------|-----------------|
| 1 | Đăng ký shipper | ShipperRegistration tạo |
| 2 | Nhận đơn giao hàng | Shipment được assign |
| 3 | Cập nhật trạng thái giao | status: PICKED_UP → IN_TRANSIT → DELIVERED |

### 5.5 Test WebSocket (Real-time)

```javascript
// Test trong browser console:
const socket = io('https://your-backend.up.railway.app', {
  auth: { token: 'your-jwt-token' }
})
socket.on('connect', () => console.log('✅ WebSocket connected'))
socket.on('notification', (data) => console.log('📨 Notification:', data))
```

---

## 🔑 Tóm Tắt Checklist Trước Khi Deploy

### Database
- [ ] Supabase project tạo xong
- [ ] `prisma db push` thành công (25+ tables)
- [ ] `seed.ts` chạy xong (có dữ liệu mẫu)
- [ ] Admin account tồn tại

### Backend  
- [ ] Đổi `pymysql` → `psycopg2-binary`
- [ ] DATABASE_URL đúng format PostgreSQL
- [ ] File upload → Supabase Storage
- [ ] Redis → Upstash URL
- [ ] Dockerfile hoạt động
- [ ] Railway deploy thành công
- [ ] `/health` trả về 200

### Frontend
- [ ] `VITE_API_URL` trỏ đúng Railway URL
- [ ] Vercel build thành công
- [ ] Login flow hoạt động
- [ ] Không có CORS error

---

## 📊 Thứ Tự Ưu Tiên Triển Khai

```
Giai đoạn 1 (Database)     ──► 1-2 giờ
    ↓
Giai đoạn 2 (Backend fix)  ──► 2-3 giờ  
    ↓
Giai đoạn 3 (Railway)      ──► 1 giờ
    ↓
Giai đoạn 4 (Vercel)       ──► 30 phút
    ↓
Giai đoạn 5 (E2E Test)     ──► 1-2 giờ
```

**Tổng thời gian ước tính: 6-9 giờ**

---

## 🛠️ Công Cụ & Tài Khoản Cần Chuẩn Bị

| Dịch vụ | Mục đích | Free tier |
|---------|---------|-----------|
| [Supabase](https://supabase.com) | PostgreSQL DB + Storage | 500MB DB, 1GB storage |
| [Railway](https://railway.app) | FastAPI backend hosting | $5 credit/tháng |
| [Vercel](https://vercel.com) | React frontend hosting | Unlimited (hobby) |
| [Upstash](https://upstash.com) | Serverless Redis | 10K req/ngày |
| [GitHub](https://github.com) | Source code + CI/CD | Free |
