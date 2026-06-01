# Deploy Backend len Render

## Yeu cau
- Da chay alembic upgrade head + python seed.py thanh cong (Giai doan 2)
- Code da push len GitHub repository

## Buoc 1: Push code len GitHub

```bash
# Tu root project
git add .
git commit -m "feat: production ready - PostgreSQL, Alembic, Render config"
git push origin main
```

## Buoc 2: Tao Web Service tren Render

1. Dang nhap render.com -> New -> Blueprint (neu dung render.yaml)
   HOAC: New -> Web Service (manual)

2. Neu manual:
   - Connect GitHub repo
   - Name: ecommerce-backend
   - Region: Singapore
   - Runtime: Docker
   - Dockerfile path: ./backend/Dockerfile
   - Docker context: ./backend
   - Branch: main

## Buoc 3: Dien Environment Variables

Vao service -> Environment -> Add variables:

| Key | Value |
|-----|-------|
| DB_HOST | aws-1-ap-northeast-1.pooler.supabase.com |
| DB_PORT | 5432 |
| DB_USER | postgres.cafnczsedbmwtoxbliwg |
| DB_PASSWORD | [Supabase DB password] |
| DB_NAME | postgres |
| DIRECT_URL | postgresql://postgres.xxx:pass@host:5432/postgres |
| SUPABASE_URL | https://xxx.supabase.co |
| SUPABASE_SERVICE_KEY | [service_role key tu Supabase Dashboard] |
| SUPABASE_ANON_KEY | [anon key tu Supabase Dashboard] |
| SUPABASE_STORAGE_BUCKET | uploads |
| SECRET_KEY | [random string dai 64 ky tu] |
| DEBUG | False |
| ENVIRONMENT | production |
| FRONTEND_URL | https://your-app.vercel.app |
| ALLOWED_ORIGINS | https://your-app.vercel.app |
| LOG_LEVEL | INFO |

## Buoc 4: Tao Supabase Storage Bucket

1. Supabase Dashboard -> Storage -> New Bucket
2. Name: uploads
3. Public: YES (de frontend hien thi anh)
4. Allowed MIME types: image/jpeg, image/png, image/webp, image/gif, application/pdf

## Buoc 5: Kiem tra sau deploy

```bash
# Thay YOUR_RENDER_URL bang URL thuc te
curl https://YOUR_RENDER_URL.onrender.com/health
# Expected: {"status":"healthy","environment":"production","storage":"supabase","debug":false}

curl https://YOUR_RENDER_URL.onrender.com/
# Expected: {"message":"E-Commerce API v1.0.0","status":"running"}

# Test login voi admin account
curl -X POST https://YOUR_RENDER_URL.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@123"}'
# Expected: {"access_token":"...","user":{...}}
```

## Luu y quan trong

- Free tier Render se sleep sau 15 phut khong co request (cold start ~30s)
- Upgrade len Starter ($7/thang) neu can always-on
- Socket.io hoat dong binh thuong tren Render Web Service
- Logs xem tai: Render Dashboard -> service -> Logs
