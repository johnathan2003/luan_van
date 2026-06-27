#!/bin/bash
# entrypoint.sh — chạy migration rồi mới start server
set -e

echo "========================================"
echo "  Running Alembic migrations..."
echo "========================================"
alembic upgrade head

echo "========================================"
echo "  Starting FastAPI server..."
echo "========================================"
exec uvicorn app.main:socket_app --host 0.0.0.0 --port 8000 --reload
