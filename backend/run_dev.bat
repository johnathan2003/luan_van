@echo off
REM Chạy development server (Windows)
call venv\Scripts\activate.bat
echo [OK] venv activated
echo [>] Starting FastAPI server...
python main.py
