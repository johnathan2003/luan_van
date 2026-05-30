#!/bin/bash
# =========================================================
#  Setup môi trường Python 3.10.11 cho E-Commerce Backend
#  Chạy: bash setup_venv.sh (từ thư mục backend/)
# =========================================================

set -e

echo "=== Kiểm tra Python 3.10 ==="
if ! python3.10 --version 2>/dev/null | grep -q "3.10"; then
    echo "[LỖI] Cần Python 3.10.x"
    echo "Ubuntu/Debian: sudo apt install python3.10 python3.10-venv"
    echo "macOS:         brew install python@3.10"
    echo "Tải tại:       https://www.python.org/downloads/release/python-31011/"
    exit 1
fi
echo "[OK] $(python3.10 --version)"

echo ""
echo "=== Tạo virtual environment 'venv' ==="
if [ -d "venv" ]; then
    echo "[SKIP] venv đã tồn tại"
else
    python3.10 -m venv venv
    echo "[OK] Tạo venv thành công"
fi

echo ""
echo "=== Kích hoạt venv ==="
source venv/bin/activate

echo ""
echo "=== Nâng cấp pip ==="
pip install --upgrade pip

echo ""
echo "=== Cài đặt dependencies ==="
pip install -r requirements.txt
echo "[OK] Cài đặt hoàn tất"

echo ""
echo "=== Tạo file .env ==="
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "[OK] Tạo .env từ .env.example"
    echo "[!]  Mở .env và điền DB_PASSWORD, SECRET_KEY, MOMO credentials"
else
    echo "[SKIP] .env đã tồn tại"
fi

echo ""
echo "========================================="
echo " Setup hoàn tất!"
echo " Để chạy server:"
echo "   source venv/bin/activate"
echo "   python main.py"
echo " API docs: http://localhost:8000/docs"
echo "========================================="
