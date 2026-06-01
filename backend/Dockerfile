# ── Build stage ───────────────────────────────────────────────────────────────
FROM python:3.10.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM python:3.10.11-slim AS runtime

WORKDIR /app

# Chi cai libpq runtime (khong can gcc)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages tu build stage
COPY --from=builder /install /usr/local

# Non-root user (best practice)
RUN useradd -m -u 1000 appuser

# Copy source code
COPY --chown=appuser:appuser . .

# Tao thu muc can thiet (uploads dung cho local dev, logs luon can)
RUN mkdir -p uploads/products uploads/users uploads/shops logs \
    && chown -R appuser:appuser uploads logs

USER appuser

EXPOSE 8000

# Production: khong dung --reload, dung $PORT tu Render
CMD ["sh", "-c", "uvicorn app.main:socket_app --host 0.0.0.0 --port ${PORT:-8000} --workers 2 --log-level info"]
