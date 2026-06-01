@echo off
REM =========================================================
REM  Setup môi trường Python 3.10.11 cho E-Commerce Backend
REM  Chạy file này từ thư mục backend/
REM =========================================================

echo === Kiểm tra Python 3.10.11 ===
python --version 2>nul | findstr "3.10" >nul
if errorlevel 1 (
    echo [LOI] Cần Python 3.10.x. Tải tại: https://www.python.org/downloads/release/python-31011/
    pause
    exit /b 1
)
echo [OK] Python 3.10 đã được cài đặt

echo.
echo === Tạo virtual environment "venv" ===
if exist venv (
    echo [SKIP] venv đã tồn tại, bỏ qua tạo mới
) else (
    python3.10 -m venv venv
    echo [OK] Tạo venv thành công
)

echo.
echo === Kích hoạt venv và cài packages ===
call venv\Scripts\activate.bat

echo.
echo === Nâng cấp pip ===
python3.10 -m pip install --upgrade pip

echo.
echo === Cài đặt dependencies ===
python3.10 -m pip install -r requirements.txt
if errorlevel 1 (
    echo [LOI] Cài đặt thất bại
    pause
    exit /b 1
)
echo [OK] Cài đặt hoàn tất

echo.
echo === Tạo file .env ===
if not exist .env (
    copy .env.example .env
    echo [OK] Tạo .env từ .env.example
    echo [!]  Mở .env và điền DB_PASSWORD, SECRET_KEY, MOMO credentials
) else (
    echo [SKIP] .env đã tồn tại
)

echo.
echo =========================================
echo  Setup hoàn tất!
echo  Để chạy server:
echo    venv\Scripts\activate
echo    python main.py
echo  API docs: http://localhost:8000/docs
echo =========================================
pause
