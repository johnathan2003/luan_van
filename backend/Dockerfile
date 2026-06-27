# ============================================================
# backend/Dockerfile
# FastAPI + SQLAlchemy
# ============================================================

FROM python:3.10-slim

WORKDIR /app

# ── System dependencies ───────────────────────────────────

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# ── Python dependencies ───────────────────────────────────

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Application code ──────────────────────────────────────
COPY . .
# Fix line endings nếu có file .sh (Windows CRLF → LF)
RUN find . -name "*.sh" -exec sed -i 's/\r//' {} \; 2>/dev/null || true

# Tạo thư mục cần thiết
RUN mkdir -p uploads logs

# ── Port ──────────────────────────────────────────────────
EXPOSE 8000

# ── Health check ──────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/docs')" || exit 1

# ── Start: chờ DB → migrate → start server ────────────────
CMD ["sh", "-c", "python wait_for_db.py && alembic upgrade head && uvicorn app.main:socket_app --host 0.0.0.0 --port 8000"]
