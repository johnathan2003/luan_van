# ============================================================
# chatbot/Dockerfile
# Chatbot service riêng — tách khỏi backend để sau này thiết bị
# IoT (ESP32-S3, mic/loa) có thể gọi thẳng vào đây mà không phải
# đụng vào backend thương mại điện tử chính.
# ============================================================

FROM python:3.10-slim

WORKDIR /app

# ── Python dependencies ───────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Application code ──────────────────────────────────────
COPY . .

# ── Port ──────────────────────────────────────────────────
EXPOSE 8002

# ── Health check ──────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8002/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
