"""
sql_guard — cho phép chatbot tự viết câu SELECT (PostgreSQL) để trả lời
những câu hỏi chưa có tool riêng, nhưng vẫn phải AN TOÀN:

  1. Chỉ chấp nhận đúng 1 câu SELECT — chặn mọi câu lệnh ghi dữ liệu.
  2. Chặn các cột/bảng nhạy cảm (password_hash, refresh_token...).
  3. Whitelist bảng được phép theo từng role.
  4. Với role không phải admin: TỰ ĐỘNG chèn điều kiện lọc theo
     user_id/shop_id/shipper_id của chính người hỏi vào WHERE — không tin
     tưởng mù quáng vào SQL do Gemini sinh ra có tự lọc đúng phạm vi hay
     không. Để việc chèn điều kiện này chắc chắn đúng, role không phải
     admin CHỈ được query đúng 1 bảng (không JOIN) — bảng nào cũng có sẵn
     cột định danh (user_id/shop_id/shipper_id) trực tiếp trên đó.
  5. Ép LIMIT, timeout, và chạy trong transaction luôn rollback (không có
     lệnh ghi nào lọt qua được thì cũng không thể commit).

LƯU Ý: đây là hàng rào ở tầng ứng dụng (Python), không phải Postgres Row-
Level Security thật sự — đủ chắc chắn để chặn AI vô tình sinh sai phạm vi
hoặc câu lệnh nguy hiểm, nhưng không phải giải pháp chống tấn công chủ đích
cấp production. Nếu triển khai thật, nên bổ sung thêm RLS ở DB.
"""
from __future__ import annotations
import re
from typing import Any

import sqlglot
from sqlglot import exp
from sqlalchemy import text
from sqlalchemy.orm import Session

# ── Bảng được phép theo role ────────────────────────────────────────────────
# admin: được JOIN nhiều bảng, không cần tự động chèn điều kiện lọc (admin
#        vốn đã thấy toàn bộ dữ liệu qua trang quản trị).
# user/shop/shipper: CHỈ những bảng có sẵn cột định danh trực tiếp, để chèn
#        điều kiện lọc luôn chính xác — không JOIN.
ADMIN_TABLES = {
    "orders", "order_items", "products", "shops", "users",
    "disputes", "vouchers", "shipments", "shop_wallet",
    "shop_wallet_transactions", "platform_transactions",
}
SCOPED_TABLES: dict[str, dict[str, str]] = {
    # role -> { table_name: scope_column }
    "user":    {"orders": "user_id"},
    "shop":    {"orders": "shop_id", "products": "shop_id", "shop_wallet_transactions": "shop_id"},
    "shipper": {"shipments": "shipper_id"},
}

BLOCKED_COLUMNS = {"password_hash", "refresh_token", "secret_key", "reset_token"}
BLOCKED_KEYWORDS = re.compile(
    r"\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|copy|call|exec|merge|attach|vacuum|pragma)\b",
    re.IGNORECASE,
)
MAX_ROWS = 50


class SqlGuardError(Exception):
    """Câu hỏi/SQL bị từ chối vì lý do an toàn — message này được trả thẳng
    cho Gemini để nó biết mà thử cách khác hoặc báo người dùng."""


def _reject_if_blocked_text(sql: str) -> None:
    if BLOCKED_KEYWORDS.search(sql):
        raise SqlGuardError("Câu SQL chứa từ khoá không được phép (chỉ cho phép SELECT).")
    lowered = sql.lower()
    for col in BLOCKED_COLUMNS:
        if col in lowered:
            raise SqlGuardError(f"Không được truy vấn cột nhạy cảm '{col}'.")
    if sql.count(";") > 1 or (sql.count(";") == 1 and not sql.strip().endswith(";")):
        raise SqlGuardError("Chỉ được chạy đúng 1 câu lệnh SQL.")


def build_safe_sql(sql: str, role: str, user: Any) -> str:
    """Kiểm tra + (nếu cần) chèn điều kiện lọc, trả về câu SQL an toàn để chạy.
    Raise SqlGuardError nếu câu hỏi không thể thực hiện an toàn."""
    sql = sql.strip().rstrip(";").strip()
    if not sql:
        raise SqlGuardError("Câu SQL trống.")
    _reject_if_blocked_text(sql)

    try:
        parsed = sqlglot.parse_one(sql, read="postgres")
    except Exception as e:
        raise SqlGuardError(f"Không phân tích được câu SQL: {e}")

    if not isinstance(parsed, exp.Select):
        raise SqlGuardError("Chỉ cho phép câu lệnh SELECT.")

    tables = {t.name.lower() for t in parsed.find_all(exp.Table)}
    if not tables:
        raise SqlGuardError("Câu SELECT phải có FROM 1 bảng hợp lệ.")

    if role == "admin":
        not_allowed = tables - ADMIN_TABLES
        if not_allowed:
            raise SqlGuardError(f"Không được truy vấn bảng: {', '.join(sorted(not_allowed))}")
    else:
        role_tables = SCOPED_TABLES.get(role, {})
        if len(tables) != 1:
            raise SqlGuardError(
                "Với vai trò này chỉ được hỏi trên đúng 1 bảng (không JOIN) để đảm bảo "
                "chỉ thấy dữ liệu của chính bạn. Hãy đặt câu hỏi đơn giản hơn."
            )
        table_name = next(iter(tables))
        scope_col = role_tables.get(table_name)
        if not scope_col:
            raise SqlGuardError(
                f"Vai trò '{role}' không được phép truy vấn bảng '{table_name}'. "
                f"Chỉ được: {', '.join(sorted(role_tables))}."
            )
        scope_value = getattr(user, "user_id", None)
        if scope_value is None:
            raise SqlGuardError("Không xác định được danh tính người hỏi.")
        # Chèn điều kiện lọc theo chính người hỏi — AND với điều kiện WHERE
        # sẵn có (nếu có), không thay thế, để không vô tình nới lỏng phạm vi.
        scope_condition = exp.condition(f"{table_name}.{scope_col} = {int(scope_value)}")
        parsed = parsed.where(scope_condition, append=True)

    # Ép LIMIT (thay LIMIT cũ nếu có, để tránh câu hỏi tự đặt LIMIT quá lớn)
    parsed.set("limit", exp.Limit(expression=exp.Literal.number(MAX_ROWS)))

    return parsed.sql(dialect="postgres")


def run_data_query(db: Session, user: Any, role: str, sql: str) -> dict:
    """Tool entrypoint — gọi từ bot_tools.py. Luôn chạy read-only, rollback
    sau khi xong (kể cả khi không có lỗi) để không có gì có thể bị ghi."""
    try:
        safe_sql = build_safe_sql(sql, role, user)
    except SqlGuardError as e:
        return {"error": str(e)}

    try:
        db.execute(text("SET LOCAL statement_timeout = '3000ms'"))
        result = db.execute(text(safe_sql))
        rows = [dict(row._mapping) for row in result.fetchall()]
        # Chuyển các kiểu không JSON-serializable (Decimal, datetime...) sang string
        for row in rows:
            for k, v in row.items():
                if not isinstance(v, (str, int, float, bool, type(None))):
                    row[k] = str(v)
        return {"rows": rows, "row_count": len(rows), "sql_executed": safe_sql}
    except Exception as e:
        return {"error": f"Lỗi khi chạy câu truy vấn: {e}"}
    finally:
        db.rollback()  # không bao giờ commit — kể cả khi lỡ có lệnh ghi lọt qua
