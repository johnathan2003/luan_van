# ============================================================
# backend/Dockerfile
# FastAPI + SQLAlchemy — dùng cho docker-compose.mysql.yml
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

# Tạo thư mục cần thiết
RUN mkdir -p uploads logs

# ── Port ──────────────────────────────────────────────────
EXPOSE 8000

# ── Health check ──────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/docs')" || exit 1

# ── Start ─────────────────────────────────────────────────
CMD ["uvicorn", "app.main:socket_app", "--host", "0.0.0.0", "--port", "8000", "--reload"]