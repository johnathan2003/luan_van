# 🚀 Shopee Clone Progress Checklist

## 🧱 Backend

### ⚙️ Core
- [x] backend/manage.py
- [] backend/Dockerfile
- [] backend/.env.example

### 📦 Requirements
- [] backend/requirements/base.txt
- [] backend/requirements/prod.txt

### ⚙️ Config
- [] backend/config/__init__.py
- [] backend/config/settings.py
- [] backend/config/urls.py
- [] backend/config/asgi.py
- [] backend/config/wsgi.py
- [] backend/config/celery.py

### 🧠 Core utils
- [] core/permissions
- [] core/middleware
- [] core/utils/pagination.py

---

## 👤 Users
- [] models.py
- [] serializers.py
- [] views.py
- [] admin.py
- [] filters.py
- [] urls/auth.py
- [] urls/users.py

---

## 🏪 Shops
- [] models.py
- [] serializers.py
- [] views.py
- [] urls.py

---

## 📦 Products
- [] models.py
- [] serializers.py
- [] views.py
- [] filters.py
- [] urls.py

---

## 🛒 Orders
- [] models.py
- [] services.py
- [] views.py
- [] serializers.py
- [] urls.py

---

## 💳 Payments
- [] models.py
- [] providers/cod.py
- [] providers/momo.py
- [] providers/vnpay.py
- [] views.py
- [] urls.py

---

## 🚚 Delivery
- [] models.py
- [] consumers.py
- [] routing.py
- [] views.py
- [] serializers.py
- [] urls.py

---

## 📦 Inventory
- [] models.py
- [] views.py
- [] tasks.py
- [] urls.py

---

## 🔔 Notifications
- [] models.py
- [] tasks.py
- [] routing.py
- [] views.py
- [] urls.py

---

## 📊 Analytics
- [] views.py
- [] urls.py
- [] tasks.py

---

## 🤖 AI Services
- [] tasks.py
- [] views.py

---

# 🎨 Frontend

## ⚙️ Setup
- [x] package.json
- [x] Dockerfile

---

## 🔌 API
- [] services/api/index.js

---

## 🪝 Hooks
- [] useWebSocket.js
- [] useAuth.js
- [] useCart.js
- [] useInfiniteScroll.js

---

## 🗄 Store
- [] authStore.js
- [] cartStore.js
- [] notificationStore.js

---

## 🧩 Components
- [] common/
- [] layout/
- [] buyer/
- [] seller/
- [] shipper/
- [] admin/

---

## 📄 Pages
- [] auth/
- [] buyer/
- [] seller/
- [] shipper/
- [] admin/

---

## 🧭 App
- [] App.jsx
- [] router.jsx