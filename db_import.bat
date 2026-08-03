@echo off
echo Kiem tra file backup.dump...
if not exist "backup.dump" (
    echo ERROR: Khong tim thay backup.dump trong thu muc nay!
    echo Hay copy file backup.dump vao day truoc.
    pause
    exit /b 1
)

echo [1/3] Dang cho DB container san sang...
:wait_loop
docker exec shopvn_db pg_isready -U shopvn_user -d ecommerce_db >nul 2>&1
if errorlevel 1 (
    echo   DB chua san sang, cho them 3 giay...
    timeout /t 3 /nobreak >nul
    goto wait_loop
)
echo   DB da san sang!

echo [2/3] Copy backup vao container...
docker cp backup.dump shopvn_db:/tmp/backup.dump

echo [3/3] Restore database...
docker exec shopvn_db pg_restore -U shopvn_user -d ecommerce_db --clean --if-exists /tmp/backup.dump

echo.
echo Done! Data da duoc restore thanh cong.
echo Mo http://localhost:8081 (Adminer) de kiem tra.
pause
