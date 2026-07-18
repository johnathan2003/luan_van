shopee-clone/
├── docker-compose.yml

├── backend/
│   ├── .env.example
│   ├── manage.py
│   ├── Dockerfile
│
│   ├── requirements/
│   │   ├── base.txt
│   │   └── prod.txt
│
│   ├── config/
│   │   ├── __init__.py
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── asgi.py
│   │   ├── wsgi.py
│   │   └── celery.py
│
│   ├── core/
│   │   ├── permissions/
│   │   │   └── __init__.py
│   │   ├── middleware/
│   │   │   └── __init__.py
│   │   └── utils/
│   │       └── pagination.py
│->>>>>>>>>>>>>>>>>>><<<<<<<<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>>>>
│   ├── apps/
│   │   ├── users/
│   │   │   ├── models.py
│   │   │   ├── serializers.py
│   │   │   ├── views.py
│   │   │   ├── admin.py
│   │   │   ├── filters.py
│   │   │   └── urls/
│   │   │       ├── auth.py
│   │   │       └── users.py
│
│   │   ├── shops/
│   │   │   ├── models.py
│   │   │   ├── serializers.py
│   │   │   ├── views.py
│   │   │   └── urls.py
│
│   │   ├── products/
│   │   │   ├── models.py
│   │   │   ├── serializers.py
│   │   │   ├── views.py
│   │   │   ├── filters.py
│   │   │   └── urls.py
│
│   │   ├── orders/
│   │   │   ├── models.py
│   │   │   ├── services.py
│   │   │   ├── views.py
│   │   │   ├── serializers.py
│   │   │   └── urls.py
│
│   │   ├── payments/
│   │   │   ├── models.py
│   │   │   ├── providers/
│   │   │   │   ├── cod.py
│   │   │   │   ├── momo.py
│   │   │   │   └── vnpay.py
│   │   │   ├── views.py
│   │   │   └── urls.py
│
│   │   ├── delivery/
│   │   │   ├── __init__.py
│   │   │   ├── models.py
│   │   │   ├── consumers.py
│   │   │   ├── routing.py
│   │   │   ├── views.py
│   │   │   ├── admin.py
│   │   │   ├── apps.py
│   │   │   ├── serializers.py
│   │   │   └── urls.py
│
│   │   ├── inventory/
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   ├── __init__.py
│   │   │   ├── admin.py
│   │   │   ├── apps.py
│   │   │   ├── tasks.py
│   │   │   └── urls.py
│
│   │   ├── notifications/
│   │   │   ├── __init__.py
│   │   │   ├── apps.py
│   │   │   ├── models.py
│   │   │   ├── tasks.py
│   │   │   ├── routing.py
│   │   │   ├── views.py
│   │   │   └── urls.py
│
│   │   ├── analytics/
│   │   │   ├── __init__.py
│   │   │   ├── views.py
│   │   │   ├── apps.py
│   │   │   ├── urls.py
│   │   │   └── tasks.py
│
│   │   └── ai_services/
│   │       ├── __init__.py
│   │       ├── tasks.py
│   │       └── apps.py
│   │       └── views.py
│
├── frontend/
│   ├── package.json
│   ├── Dockerfile
│
│   ├── src/
│   │   ├── services/
│   │   │   └── api/
│   │   │       └── index.js
│   │
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js
│   │   │   ├── index.js  
│   │   │   ├── useAuth.js            x
│   │   │   ├── useCart.js              x
│   │   │   └── useInfiniteScroll.js
│   │
│   │   ├── store/
│   │   │   ├── authStore.js
│   │   │   ├── cartStore.js
│   │   │   └── notificationStore.js
│   │
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── layout/
│   │   │   ├── buyer/
│   │   │   ├── seller/
│   │   │   ├── shipper/
│   │   │   └── admin/
│   │
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   ├── buyer/
│   │   │   ├── seller/
│   │   │   ├── shipper/
│   │   │   └── admin/
│   │
│   │   ├── App.jsx
│   │   └── router.jsx