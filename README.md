# E-Commerce Platform

Nen tang thuong mai dien tu da vai tro: Buyer, Seller, Shipper, Admin.

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | React 18 + TypeScript + Vite        |
| State     | Redux Toolkit + Zustand (legacy jsx)|
| Backend   | FastAPI (Python 3.10)               |
| ORM       | SQLAlchemy 2.0                      |
| Migration | Alembic                             |
| Database  | PostgreSQL (Supabase)               |
| Storage   | Supabase Storage                    |
| Realtime  | Socket.io                           |
| Deploy FE | Vercel                              |
| Deploy BE | Render                              |

## Project Structure

```
project/
├── backend/                # FastAPI backend
│   ├── app/
│   │   ├── models/         # SQLAlchemy models
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── middleware/     # Auth, error handler
│   │   ├── websocket/      # Socket.io handlers
│   │   └── utils/          # Helpers, upload service
│   ├── migrations/         # Alembic migrations
│   │   └── versions/
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── seed.py             # Database seeder
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/               # React + TypeScript
│   └── src/
│       ├── pages/          # Pages by role
│       │   ├── user/       # Buyer pages (tsx)
│       │   ├── shop/       # Seller pages (tsx)
│       │   ├── shipper/    # Shipper pages (tsx)
│       │   ├── admin/      # Admin pages (tsx)
│       │   ├── buyer/      # Legacy buyer pages (jsx)
│       │   └── seller/     # Legacy seller pages (jsx)
│       ├── components/     # Shared components
│       ├── store/          # Redux slices + Zustand stores
│       ├── services/       # API service layer
│       ├── hooks/          # Custom React hooks
│       ├── types/          # TypeScript types
│       └── utils/          # Helpers, formatters
│
├── prisma/                 # DB schema reference only
├── .env                    # Supabase connection strings
└── docker-compose.yml      # Local development
```

## Setup Local Development

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and fill env
cp .env.example .env

# Run migrations
alembic upgrade head

# Seed data
python seed.py

# Start server
uvicorn app.main:socket_app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local  # Add VITE_API_URL=http://localhost:8000
npm run dev
```

## Test Accounts (after seed)

| Email                 | Password     | Role      |
|-----------------------|-------------|-----------|
| admin@example.com     | Admin@123   | Admin     |
| owner1@shop.com       | Owner@123   | Shop Owner|
| owner2@shop.com       | Owner@123   | Shop Owner|
| shipper1@example.com  | Shipper@123 | Shipper   |
| customer1@example.com | Customer@123| Customer  |

## API Documentation

Start backend then open: http://localhost:8000/docs
