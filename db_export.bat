@echo off
echo [1/2] Dumping database from container...
docker exec shopvn_db pg_dump -U shopvn_user -Fc ecommerce_db -f /tmp/backup.dump

echo [2/2] Copying backup.dump to current folder...
docker cp shopvn_db:/tmp/backup.dump ./backup.dump

echo.
echo Done! File: backup.dump
echo Chuyen file nay sang may khac roi chay db_import.bat
pause
