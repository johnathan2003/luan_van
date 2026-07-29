"""
super/backend/routes/db_viewer.py
-----------------------------------
MySQL-like table/data inspector cho Superadmin.
Dùng SQLAlchemy inspect() để đọc schema động.

Endpoints:
  GET  /api/super/db-viewer/tables                    — danh sách bảng + row count
  GET  /api/super/db-viewer/tables/{table}/schema     — cột, kiểu, nullable, PK, FK
  GET  /api/super/db-viewer/tables/{table}/data       — dữ liệu phân trang + filter + sort
  POST /api/super/db-viewer/exec                      — raw SELECT (chỉ READ)
"""
from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.database import get_db, engine
from super.middleware import require_super

router = APIRouter()

# ── Helpers ───────────────────────────────────────────────────────────────────

_SAFE_IDENT = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*$')


def _safe(name: str, label: str = "identifier") -> str:
    if not _SAFE_IDENT.match(name):
        raise HTTPException(status_code=400, detail=f"Invalid {label}: {name!r}")
    return name


def _get_tables() -> list[str]:
    return sorted(inspect(engine).get_table_names())


def _get_schema(table: str) -> list[dict]:
    insp = inspect(engine)
    cols = insp.get_columns(table)
    pk_cols = set(insp.get_pk_constraint(table).get("constrained_columns", []))
    fks = {
        fk["constrained_columns"][0]: fk
        for fk in insp.get_foreign_keys(table)
        if fk["constrained_columns"]
    }
    result = []
    for col in cols:
        fk_info = None
        if col["name"] in fks:
            fk = fks[col["name"]]
            fk_info = {
                "referred_table":  fk.get("referred_table"),
                "referred_column": fk["referred_columns"][0] if fk.get("referred_columns") else None,
            }
        result.append({
            "name":        col["name"],
            "type":        str(col["type"]),
            "nullable":    col.get("nullable", True),
            "default":     str(col["default"]) if col.get("default") is not None else None,
            "primary_key": col["name"] in pk_cols,
            "foreign_key": fk_info,
        })
    return result


def _row_count(db: Session, table: str) -> int:
    try:
        return int(db.execute(text(f'SELECT COUNT(*) FROM "{table}"')).scalar() or 0)
    except Exception:
        return -1


def _ser(v: Any) -> Any:
    if v is None or isinstance(v, (int, float, bool, str)):
        return v
    return str(v)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/tables")
def list_tables(
    _: dict = Depends(require_super),
    db: Session = Depends(get_db),
):
    """Tất cả bảng với row count và column count."""
    tables = _get_tables()
    insp = inspect(engine)
    return {
        "tables": [
            {
                "table_name":   t,
                "column_count": len(insp.get_columns(t)),
                "row_count":    _row_count(db, t),
            }
            for t in tables
        ],
        "total": len(tables),
    }


@router.get("/tables/{table_name}/schema")
def table_schema(
    table_name: str,
    _: dict = Depends(require_super),
):
    """Schema chi tiết: cột, kiểu, PK, FK, nullable."""
    t = _safe(table_name, "table name")
    if t not in _get_tables():
        raise HTTPException(status_code=404, detail=f"Table '{t}' not found")
    return {"table": t, "columns": _get_schema(t)}


@router.get("/tables/{table_name}/data")
def table_data(
    table_name: str,
    page:       int = Query(1, ge=1),
    limit:      int = Query(50, ge=1, le=500),
    sort_col:   str | None = Query(None),
    sort_dir:   str = Query("asc", regex="^(asc|desc)$"),
    search_col: str | None = Query(None),
    search_val: str | None = Query(None),
    _: dict = Depends(require_super),
    db: Session = Depends(get_db),
):
    """Dữ liệu phân trang — hỗ trợ sort + ILIKE search theo 1 cột."""
    t = _safe(table_name, "table name")
    if t not in _get_tables():
        raise HTTPException(status_code=404, detail=f"Table '{t}' not found")

    schema_cols = [c["name"] for c in _get_schema(t)]

    where_clause = ""
    params: dict = {}
    if search_col and search_val and search_col in schema_cols:
        sc = _safe(search_col)
        where_clause = f'WHERE CAST("{sc}" AS TEXT) ILIKE :sv'
        params["sv"] = f"%{search_val}%"

    order_clause = ""
    if sort_col and sort_col in schema_cols:
        order_clause = f'ORDER BY "{_safe(sort_col)}" {sort_dir.upper()}'
    elif schema_cols:
        order_clause = f'ORDER BY "{schema_cols[0]}" ASC'

    offset = (page - 1) * limit
    total = int(db.execute(text(f'SELECT COUNT(*) FROM "{t}" {where_clause}'), params).scalar() or 0)

    rows = db.execute(
        text(f'SELECT * FROM "{t}" {where_clause} {order_clause} LIMIT :lim OFFSET :off'),
        {**params, "lim": limit, "off": offset},
    ).mappings().all()

    return {
        "table":   t,
        "columns": schema_cols,
        "rows":    [{k: _ser(v) for k, v in row.items()} for row in rows],
        "total":   total,
        "page":    page,
        "pages":   max(1, (total + limit - 1) // limit),
        "limit":   limit,
    }


@router.post("/exec")
def exec_query(
    body: dict,
    _: dict = Depends(require_super),
    db: Session = Depends(get_db),
):
    """Raw SELECT — cho giảng viên xem dữ liệu tuỳ ý trong demo."""
    sql: str = body.get("sql", "").strip()
    if not sql:
        raise HTTPException(status_code=400, detail="SQL query is required")

    norm = re.sub(r'\s+', ' ', sql.upper())
    if not (norm.startswith("SELECT") or norm.startswith("WITH")):
        raise HTTPException(status_code=400, detail="Only SELECT statements are allowed")

    try:
        rows = db.execute(text(sql)).mappings().all()
        if not rows:
            return {"columns": [], "rows": [], "total": 0}
        columns = list(rows[0].keys())
        return {
            "columns": columns,
            "rows":    [{k: _ser(v) for k, v in row.items()} for row in rows],
            "total":   len(rows),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Query error: {str(e)}")
