# Chạy migration

## Migrations đã có

| Revision       | Mô tả                                      |
|----------------|--------------------------------------------|
| 202606250001   | shipper_bonuses, transactions, withdrawals, incidents |
| 202606250002   | banners, feedbacks, shipping_zones, shipping_methods, platform_transactions |

## Cách 1 — Restart container (tự động)

```bash
docker compose restart backend
```

`entrypoint.sh` tự chạy `alembic upgrade head` khi container khởi động.

## Cách 2 — Chạy trực tiếp (không cần restart)

```bash
docker compose exec backend alembic upgrade head
```

## Kiểm tra sau khi chạy

```bash
docker compose exec backend alembic current
# Expected: 202606250002 (head)
```
