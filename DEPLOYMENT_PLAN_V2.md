# Ke Hoach Trien Khai V2
**Stack:** FastAPI - SQLAlchemy - Alembic - PostgreSQL - Supabase - Render - Vercel

---

## Kien Truc Muc Tieu

```
GIAI DOAN DEMO (hien tai)
=============================
  Render (FastAPI + Swagger UI /docs)
       |
       +---> Supabase PostgreSQL
       +---> Supabase Storage


GIAI DOAN CUOI (sau nay)
=============================
  Vercel (React Frontend)
       |
       v
  Render (FastAPI)
       |
       +---> Supabase PostgreSQL
       +---> Supabase Storage
```

---

## Trang Thai

| # | Giai doan | Trang thai |
|---|-----------|-----------|
| 1 | Fix Backend Codebase | DONE |
| 2 | Migration + Seed len Supabase | CHO BAN chay local |
| 3 | Deploy Backend len Render | CHO BAN |
| 4 | Demo qua Swagger UI /docs | Sau khi Render chay |
| 5 | Deploy Frontend Vercel | SAU CUNG |
| 6 | E2E Testing | SAU CUNG |

---

## GIAI DOAN 2 — Migration + Seed (Ban chay tren may local)

```bash
cd backend

# Cai dependencies (neu chua co)
pip install -r requirements.txt

# Apply schema len Supabase
alembic upgrade head
# Expected: Running upgrade ...202606010915 -> 202606010916

# Seed du lieu mau
python seed.py
# Expected: 6 users, 2 shops, 8 products, 5 orders...
```

Kiem tra: Supabase Dashboard -> Table Editor -> thay du lieu

---

## GIAI DOAN 3 — Deploy Backend len Render

### Buoc 1: Push code GitHub
```bash
git add .
git commit -m "feat: production ready"
git push origin main
```

### Buoc 2: Tao Web Service tren Render
- render.com -> New -> Web Service
- Connect GitHub repo
- Root Directory: `backend`
- Runtime: Docker

### Buoc 3: Dien env vars bat buoc

| Bien | Gia tri | Lay o dau |
|------|---------|-----------|
| DB_HOST | `aws-1-ap-northeast-1.pooler.supabase.com` | .env goc |
| DB_PORT | `5432` | fix |
| DB_USER | `postgres.cafnczsedbmwtoxbliwg` | .env goc |
| DB_PASSWORD | mat khau Supabase | .env goc |
| DB_NAME | `postgres` | fix |
| SUPABASE_URL | `https://xxx.supabase.co` | Supabase > Settings > API |
| SUPABASE_SERVICE_KEY | service_role key | Supabase > Settings > API |
| SECRET_KEY | random string | Render tu gen hoac tu tao |
| **DEBUG** | **`True`** | **Bat de xem /docs** |
| ENVIRONMENT | `production` | fix |
| ALLOWED_ORIGINS | `*` | tam thoi |

> DEBUG=True de bat Swagger UI /docs cho phan demo.
> Sau khi xong Vercel thi doi lai DEBUG=False.

---

## GIAI DOAN 4 — Demo qua Swagger UI

Sau khi Render deploy xong, mo trinh duyet:

```
https://YOUR-APP.onrender.com/docs
```

**Test flow don gian nhat:**

1. **Health check** — `GET /health` -> verify connected Supabase
2. **Login admin** — `POST /api/v1/auth/login`
   ```json
   { "email": "admin@example.com", "password": "Admin@123" }
   ```
   Copy `access_token` tu response

3. **Authorize** — Click nut **Authorize** tren Swagger, dan token vao:
   ```
   Bearer <access_token>
   ```

4. **Test cac endpoint:**
   - `GET /api/v1/products` — list san pham
   - `GET /api/v1/shop` — list shops
   - `GET /api/v1/admin/overview` — admin dashboard data
   - `GET /api/v1/notifications` — notifications

**Ket qua mong doi:**
- Tat ca endpoint tra ve data tu Supabase
- Auth hoat dong dung (401 neu chua login, 200 sau khi login)
- Socket.io connect duoc

---

## GIAI DOAN 5 — Deploy Frontend Vercel (SAU CUNG)

> Chi lam sau khi da confirm backend chay on dinh tren Render

Viec minh se lam:
- `frontend/vercel.json` (React Router SPA fix)
- `frontend/.env.production` voi dung Render URL
- Huong dan deploy + env vars tren Vercel Dashboard
- Doi `ALLOWED_ORIGINS` tren Render tu `*` sang Vercel URL
- Doi `DEBUG=False` tren Render

---

## GIAI DOAN 6 — E2E Testing

Full flow sau khi co ca frontend + backend:
- Buyer, Seller, Admin, Shipper flow
- Payment gateway (MoMo sandbox)
- WebSocket realtime notifications

---

## Thong tin can co cho Render (tom tat)

**Da co trong `E:\luan_van\.env`:**
- DB_HOST, DB_USER, DB_PASSWORD, DIRECT_URL

**Can lay them tu Supabase Dashboard -> Settings -> API:**
- SUPABASE_URL (Project URL)
- SUPABASE_SERVICE_KEY (service_role, bam Reveal)
- SUPABASE_ANON_KEY (anon public)

**Tu tao:**
- SECRET_KEY: chay `python -c "import secrets; print(secrets.token_hex(32))"`

---

> Quy tac: Minh lam het 1 giai doan, dung cho ban check,
> ban OK moi chay tiep.
