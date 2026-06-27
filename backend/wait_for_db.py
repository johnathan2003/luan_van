"""
wait_for_db.py — chờ PostgreSQL ready trước khi migrate + start server
"""
import os, sys, time
import psycopg2

url = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL", "")
max_tries = 30

print(f"Waiting for database at: {url.split('@')[-1] if '@' in url else url}")

for i in range(max_tries):
    try:
        conn = psycopg2.connect(url)
        conn.close()
        print(f"✓ Database is ready! (attempt {i + 1})")
        sys.exit(0)
    except Exception as e:
        print(f"  [{i + 1}/{max_tries}] DB not ready: {e}")
        time.sleep(2)

print("✗ Database not available after retries. Exiting.")
sys.exit(1)
