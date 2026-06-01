# Chay Migration & Seed len Supabase

> Chay 3 lenh nay tren may LOCAL (can ket noi internet den Supabase)

## Yeu cau truoc khi chay
- Python 3.10+ da cai
- Da activate virtual environment hoac cai san psycopg2-binary, alembic

```bash
cd backend

# 1. Cai dependencies (neu chua co)
pip install psycopg2-binary==2.9.9 alembic==1.12.1 sqlalchemy==2.0.23 \
    pydantic-settings==2.1.0 python-dotenv==1.0.0 passlib[bcrypt]==1.7.4

# 2. Kiem tra migration da san sang
alembic history
# Expected: 202606010915 -> 202606010916 (head)

# 3. Chay migration len Supabase (dung DIRECT_URL)
alembic upgrade head
# Expected: Running upgrade 202606010915 -> 202606010916, Initial schema

# 4. Chay seed data
python seed.py
# Expected: 32 tables created, seed data inserted
```

## Kiem tra sau khi chay
Mo Supabase Dashboard -> Table Editor, kiem tra:
- Bang users co 6 rows
- Bang roles co 5 rows  
- Bang products co 8 rows
- Bang orders co 5 rows

## Tai khoan test
- admin@example.com    / Admin@123
- owner1@shop.com      / Owner@123
- owner2@shop.com      / Owner@123
- shipper1@example.com / Shipper@123
- customer1@example.com/ Customer@123
