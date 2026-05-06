import os

dirs = [
# backend
"backend/requirements",
"backend/config",
"backend/core/permissions",
"backend/core/middleware",
"backend/core/utils",
"backend/apps/users",
"backend/apps/shops",
"backend/apps/products",
"backend/apps/orders",
"backend/apps/payments/providers",
"backend/apps/delivery",
"backend/apps/inventory",
"backend/apps/notifications",
"backend/apps/analytics",
"backend/apps/ai_services",

# frontend
"frontend/src/services/api",
"frontend/src/hooks",
"frontend/src/store",
"frontend/src/components/common",
"frontend/src/components/layout",
"frontend/src/components/buyer",
"frontend/src/components/seller",
"frontend/src/components/shipper",
"frontend/src/components/admin",
"frontend/src/pages/auth",
"frontend/src/pages/buyer",
"frontend/src/pages/seller",
"frontend/src/pages/shipper",
"frontend/src/pages/admin",
]

files = [
# root
"docker-compose.yml",

# backend
"backend/manage.py",
"backend/Dockerfile",
"backend/.env.example",

"backend/requirements/base.txt",
"backend/requirements/prod.txt",

"backend/config/__init__.py",
"backend/config/settings.py",
"backend/config/urls.py",
"backend/config/asgi.py",
"backend/config/wsgi.py",
"backend/config/celery.py",

"backend/core/permissions/__init__.py",
"backend/core/middleware/__init__.py",
"backend/core/utils/pagination.py",

# users
"backend/apps/users/models.py",
"backend/apps/users/serializers.py",
"backend/apps/users/views.py",
"backend/apps/users/admin.py",
"backend/apps/users/filters.py",
"backend/apps/users/urls/auth.py",
"backend/apps/users/urls/users.py",

# shops
"backend/apps/shops/models.py",
"backend/apps/shops/serializers.py",
"backend/apps/shops/views.py",
"backend/apps/shops/urls.py",

# products
"backend/apps/products/models.py",
"backend/apps/products/serializers.py",
"backend/apps/products/views.py",
"backend/apps/products/filters.py",
"backend/apps/products/urls.py",

# orders
"backend/apps/orders/models.py",
"backend/apps/orders/services.py",
"backend/apps/orders/views.py",
"backend/apps/orders/serializers.py",
"backend/apps/orders/urls.py",

# payments
"backend/apps/payments/models.py",
"backend/apps/payments/providers/cod.py",
"backend/apps/payments/providers/momo.py",
"backend/apps/payments/providers/vnpay.py",
"backend/apps/payments/views.py",
"backend/apps/payments/urls.py",

# delivery
"backend/apps/delivery/models.py",
"backend/apps/delivery/consumers.py",
"backend/apps/delivery/routing.py",
"backend/apps/delivery/views.py",
"backend/apps/delivery/serializers.py",
"backend/apps/delivery/urls.py",

# inventory
"backend/apps/inventory/models.py",
"backend/apps/inventory/views.py",
"backend/apps/inventory/tasks.py",
"backend/apps/inventory/urls.py",

# notifications
"backend/apps/notifications/models.py",
"backend/apps/notifications/tasks.py",
"backend/apps/notifications/routing.py",
"backend/apps/notifications/views.py",
"backend/apps/notifications/urls.py",

# analytics
"backend/apps/analytics/views.py",
"backend/apps/analytics/urls.py",
"backend/apps/analytics/tasks.py",

# ai
"backend/apps/ai_services/tasks.py",
"backend/apps/ai_services/views.py",

# frontend
"frontend/package.json",
"frontend/Dockerfile",

"frontend/src/services/api/index.js",

"frontend/src/hooks/useWebSocket.js",
"frontend/src/hooks/useAuth.js",
"frontend/src/hooks/useCart.js",
"frontend/src/hooks/useInfiniteScroll.js",

"frontend/src/store/authStore.js",
"frontend/src/store/cartStore.js",
"frontend/src/store/notificationStore.js",

"frontend/src/App.jsx",
"frontend/src/router.jsx",
]

# tạo folder
for d in dirs:
    os.makedirs(d, exist_ok=True)

# tạo file
for f in files:
    os.makedirs(os.path.dirname(f), exist_ok=True)
    with open(f, "w", encoding="utf-8") as file:
        pass

print("🚀 DONE: Đã tạo FULL backend + frontend structure")