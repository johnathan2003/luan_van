"""
Bot service — Google Gemini API với function calling.
Model: gemini-3.5-flash-lite cho mọi role (xem lịch sử đổi model bên dưới).
Cache kết quả tool qua Redis (TTL 5 phút).

Di chuyển từ backend/app/services/bot_service.py sang chatbot service riêng
(2026-08-04) — tách khỏi backend chính để chuẩn bị cho thiết bị IoT
(ESP32-S3, có mic/loa) gọi thẳng vào chatbot service này sau này, không phải
đi qua backend thương mại điện tử. Logic giữ nguyên, chỉ đổi import
bot_tools từ `app.services.bot_tools` → import cục bộ (cùng thư mục
chatbot/) vì bot_tools.py cũng đã chuyển ra đây.
"""
from __future__ import annotations
import hashlib
import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.config import settings
from bot_tools import execute_tool, ACTION_TOOLS

logger = logging.getLogger(__name__)

# ── Model selection ────────────────────────────────────────────────────────────
# gemini-1.5-* đã bị retire.
# LỊCH SỬ (đã thực tế gặp lỗi khi chạy — xem docker logs):
#   gemini-3.5-flash  free tier chỉ  20 requests/NGÀY  → hết quota chỉ sau vài câu hỏi.
#   gemini-2.5-flash  → 404 NOT_FOUND: "no longer available to new users" (Google đã
#                       khoá model này cho project/API key mới, kể cả khi docs vẫn
#                       còn liệt kê model — chỉ project cũ được dùng tiếp).
# → Dùng gemini-3.5-flash-lite: model hiện hành (Stable, trong dòng Gemini 3),
#   vẫn hỗ trợ đầy đủ function-calling, được Google quảng bá là lựa chọn
#   "nhanh và tiết kiệm nhất" nên quota free tier rộng rãi hơn bản Flash đầy đủ.
# Nếu vẫn hết quota thường xuyên: bật billing cho project (Google AI Studio →
# Billing) để chuyển sang usage tier trả phí — chi phí model Flash rất rẻ,
# và giới hạn requests/ngày của free tier sẽ không còn áp dụng nữa.
_FLASH = "gemini-3.5-flash-lite"
_PRO   = "gemini-3.5-flash-lite"  # dùng chung 1 model cho mọi role để ổn định quota

def _model_for_role(role: str) -> str:
    # Muốn bật lại Pro riêng cho admin (cần quota/billing rộng hơn):
    # đổi lại `return _PRO if role == "admin" else _FLASH`.
    return _FLASH


# ── Tool definitions (Gemini function_declarations format) ────────────────────
_ADMIN_TOOLS = [
    {
        "name": "admin_query_stats",
        "description": "Lấy thống kê tổng quan hệ thống: doanh thu, số đơn hàng, người dùng mới, shop hoạt động.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "period": {"type": "STRING", "description": "today | week | month | year"},
                "metric": {"type": "STRING", "description": "all | revenue | users | shops"},
            },
        },
    },
    {
        "name": "admin_filter_shops",
        "description": "Lọc danh sách shop theo trạng thái hoặc từ khóa tên.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "status": {"type": "STRING", "description": "pending | approved | rejected"},
                "search": {"type": "STRING", "description": "Từ khóa tên shop"},
                "limit":  {"type": "INTEGER"},
            },
        },
    },
    {
        "name": "admin_filter_orders",
        "description": "Xem danh sách đơn hàng theo trạng thái và khoảng thời gian.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "status": {"type": "STRING", "description": "pending | confirmed | paid | ready_to_ship | shipped | delivered | completed | cancelled | returned"},
                "period": {"type": "STRING", "description": "today | week | month"},
                "limit":  {"type": "INTEGER"},
            },
        },
    },
    {
        "name": "admin_get_disputes",
        "description": "Xem các khiếu nại/tranh chấp trong hệ thống.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "status": {"type": "STRING", "description": "open | resolved | escalated"},
                "limit":  {"type": "INTEGER"},
            },
        },
    },
    {
        "name": "admin_top_shops",
        "description": "Xếp hạng top shop theo doanh thu trong kỳ.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "period": {"type": "STRING", "description": "week | month | year"},
                "limit":  {"type": "INTEGER"},
            },
        },
    },
    {
        "name": "admin_get_pending_shippers",
        "description": "Xem danh sách đơn đăng ký shipper đang chờ admin duyệt.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "limit": {"type": "INTEGER"},
            },
        },
    },
    {
        "name": "admin_approve_shop",
        "description": "Phê duyệt hoặc từ chối đơn đăng ký mở shop. Cần xác nhận trước khi gọi.",
        "parameters": {
            "type": "OBJECT",
            "required": ["reg_id", "action"],
            "properties": {
                "reg_id":           {"type": "INTEGER", "description": "ID đơn đăng ký shop"},
                "action":           {"type": "STRING",  "description": "approve | reject"},
                "rejection_reason": {"type": "STRING",  "description": "Lý do từ chối (nếu reject)"},
            },
        },
    },
    {
        "name": "admin_resolve_dispute",
        "description": "Giải quyết tranh chấp. Cần xác nhận với admin trước khi gọi.",
        "parameters": {
            "type": "OBJECT",
            "required": ["dispute_id", "verdict"],
            "properties": {
                "dispute_id":         {"type": "INTEGER", "description": "ID tranh chấp"},
                "verdict":            {"type": "STRING",  "description": "resolve | reject | escalate"},
                "resolution_details": {"type": "STRING",  "description": "Mô tả cách giải quyết"},
            },
        },
    },
    {
        "name": "admin_query_data",
        "description": (
            "DÙNG KHI câu hỏi cần dữ liệu nhưng KHÔNG khớp tool nào ở trên. "
            "Tự viết 1 câu SELECT PostgreSQL chỉ đọc. Được JOIN nhiều bảng trong danh sách: "
            "orders(order_id,user_id,shop_id,shipper_id,total_price,final_price,shipping_fee,"
            "payment_method,payment_status,order_status,created_at), "
            "order_items(order_item_id,order_id,product_id,quantity,price_at_order,product_name), "
            "products(product_id,shop_id,category_id,product_name,price,stock_quantity,status,"
            "sales_count,views_count,rating,created_at), "
            "shops(shop_id,shop_name,verification_status,rating,created_at), "
            "disputes(dispute_id,order_id,status,reason,created_at), "
            "vouchers(voucher_id,code,discount_type,discount_value,is_active,end_date), "
            "shipments(shipment_id,order_id,shipper_id,status,created_at,updated_at), "
            "shop_wallet(wallet_id,shop_id,balance,reserved), "
            "shop_wallet_transactions(txn_id,shop_id,amount,txn_type,created_at). "
            "TUYỆT ĐỐI không SELECT cột password_hash/refresh_token của bảng users. "
            "Luôn thêm LIMIT hợp lý."
        ),
        "parameters": {
            "type": "OBJECT",
            "required": ["sql"],
            "properties": {
                "sql": {"type": "STRING", "description": "Câu SELECT PostgreSQL hợp lệ, chỉ đọc"},
            },
        },
    },
]

_USER_TOOLS = [
    {
        "name": "user_search_products",
        "description": "Tìm kiếm và gợi ý sản phẩm theo từ khóa, danh mục, khoảng giá, sắp xếp.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "query":       {"type": "STRING",  "description": "Từ khóa tìm kiếm (tên sản phẩm)"},
                "category_id": {"type": "INTEGER", "description": "ID danh mục"},
                "min_price":   {"type": "NUMBER",  "description": "Giá tối thiểu (VND)"},
                "max_price":   {"type": "NUMBER",  "description": "Giá tối đa (VND)"},
                "sort":        {"type": "STRING",  "description": "popular | cheapest | rating | newest"},
                "limit":       {"type": "INTEGER"},
            },
        },
    },
    {
        "name": "user_get_order_status",
        "description": "Xem trạng thái đơn hàng gần nhất hoặc theo order_id.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "order_id": {"type": "INTEGER", "description": "Để trống = đơn hàng gần nhất"},
            },
        },
    },
    {
        "name": "user_get_order_history",
        "description": "Xem lịch sử đặt hàng của người dùng.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "limit": {"type": "INTEGER"},
            },
        },
    },
    {
        "name": "user_get_vouchers",
        "description": "Xem danh sách voucher đang có hiệu lực trên sàn.",
        "parameters": {"type": "OBJECT", "properties": {}},
    },
    {
        "name": "user_cancel_order",
        "description": "Hủy đơn hàng của người dùng (chỉ hủy được đơn ở trạng thái 'pending'). Hỏi xác nhận trước khi gọi.",
        "parameters": {
            "type": "OBJECT",
            "required": ["order_id"],
            "properties": {
                "order_id": {"type": "INTEGER", "description": "ID đơn hàng cần hủy"},
            },
        },
    },
    {
        "name": "user_query_data",
        "description": (
            "DÙNG KHI câu hỏi cần dữ liệu đơn hàng nhưng KHÔNG khớp tool nào ở trên. "
            "Tự viết 1 câu SELECT PostgreSQL chỉ đọc, CHỈ trên bảng orders (KHÔNG JOIN bảng "
            "khác): order_id, order_number, total_price, discount_amount, final_price, "
            "shipping_fee, payment_method, payment_status, order_status, shipping_address, "
            "created_at. Hệ thống tự lọc chỉ trả đơn của người hỏi, không cần tự thêm điều "
            "kiện user_id. Luôn thêm LIMIT hợp lý."
        ),
        "parameters": {
            "type": "OBJECT",
            "required": ["sql"],
            "properties": {
                "sql": {"type": "STRING", "description": "Câu SELECT PostgreSQL trên bảng orders, chỉ đọc"},
            },
        },
    },
]

_SHOP_TOOLS = [
    {
        "name": "shop_get_stats",
        "description": "Xem thống kê doanh thu, số đơn hàng, đơn đang chờ xác nhận của shop.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "period": {"type": "STRING", "description": "today | week | month"},
            },
        },
    },
    {
        "name": "shop_get_product_count",
        "description": "Đếm tổng số sản phẩm của shop, chia theo trạng thái (active, approved, pending, rejected, archived). Dùng khi được hỏi 'shop có bao nhiêu sản phẩm'.",
        "parameters": {"type": "OBJECT", "properties": {}},
    },
    {
        "name": "shop_get_low_stock",
        "description": "Xem danh sách sản phẩm sắp hết hàng (tồn kho ≤ threshold).",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "threshold": {"type": "INTEGER", "description": "Ngưỡng cảnh báo, mặc định 5"},
            },
        },
    },
    {
        "name": "shop_get_top_products",
        "description": "Xem top sản phẩm bán chạy hoặc được xem nhiều nhất của shop.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "metric": {"type": "STRING", "description": "sales | views"},
                "limit":  {"type": "INTEGER"},
            },
        },
    },
    {
        "name": "shop_get_pending_orders",
        "description": "Xem danh sách đơn hàng đang chờ xác nhận của shop.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "limit": {"type": "INTEGER"},
            },
        },
    },
    {
        "name": "shop_get_wallet_balance",
        "description": "Xem số dư ví shop (tổng, đang giữ, khả dụng).",
        "parameters": {"type": "OBJECT", "properties": {}},
    },
    {
        "name": "shop_confirm_order",
        "description": "Xác nhận đơn hàng pending của shop. Hỏi xác nhận trước khi gọi.",
        "parameters": {
            "type": "OBJECT",
            "required": ["order_id"],
            "properties": {
                "order_id": {"type": "INTEGER", "description": "ID đơn hàng cần xác nhận"},
            },
        },
    },
    {
        "name": "shop_query_data",
        "description": (
            "DÙNG KHI câu hỏi cần dữ liệu shop nhưng KHÔNG khớp tool nào ở trên. Tự viết 1 câu "
            "SELECT PostgreSQL chỉ đọc, CHỈ trên 1 trong 3 bảng sau (KHÔNG JOIN): "
            "orders(order_id,total_price,final_price,payment_status,order_status,created_at), "
            "products(product_id,category_id,product_name,price,stock_quantity,status,"
            "sales_count,views_count,rating,created_at), "
            "shop_wallet_transactions(txn_id,amount,txn_type,ref_type,created_at). "
            "Hệ thống tự lọc chỉ trả dữ liệu của shop người hỏi, không cần tự thêm điều kiện "
            "shop_id. Luôn thêm LIMIT hợp lý."
        ),
        "parameters": {
            "type": "OBJECT",
            "required": ["sql"],
            "properties": {
                "sql": {"type": "STRING", "description": "Câu SELECT PostgreSQL trên 1 bảng, chỉ đọc"},
            },
        },
    },
]

_SHIPPER_TOOLS = [
    {
        "name": "shipper_get_deliveries",
        "description": "Xem danh sách đơn giao hàng của shipper theo trạng thái.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "status": {"type": "STRING", "description": "pending | packed | assigned_pickup | at_ward_warehouse | at_district_warehouse | at_hub_hanoi | in_transit_interprovincial | at_hub_hcmc | at_district_hcmc | at_ward_hcmc | out_for_delivery | delivered | failed"},
                "limit":  {"type": "INTEGER"},
            },
        },
    },
    {
        "name": "shipper_get_earnings",
        "description": "Xem thu nhập của shipper theo khoảng thời gian.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "period": {"type": "STRING", "description": "today | week | month"},
            },
        },
    },
    {
        "name": "shipper_get_profile",
        "description": "Xem hồ sơ shipper: rating, tổng số đơn, tổng thu nhập, trạng thái.",
        "parameters": {"type": "OBJECT", "properties": {}},
    },
    {
        "name": "shipper_get_next_delivery",
        "description": "Lấy đơn giao hàng tiếp theo cần xử lý (được giao nhưng chưa hoàn thành).",
        "parameters": {"type": "OBJECT", "properties": {}},
    },
    {
        "name": "shipper_update_delivery",
        "description": "Cập nhật trạng thái đơn giao hàng. Hỏi xác nhận trước khi gọi.",
        "parameters": {
            "type": "OBJECT",
            "required": ["delivery_id", "status"],
            "properties": {
                "delivery_id": {"type": "INTEGER", "description": "ID shipment cần cập nhật"},
                "status":      {"type": "STRING",  "description": "out_for_delivery | delivered | failed"},
                "note":        {"type": "STRING",  "description": "Lý do thất bại (bắt buộc khi failed)"},
            },
        },
    },
    {
        "name": "shipper_query_data",
        "description": (
            "DÙNG KHI câu hỏi cần dữ liệu giao hàng nhưng KHÔNG khớp tool nào ở trên. Tự viết "
            "1 câu SELECT PostgreSQL chỉ đọc, CHỈ trên bảng shipments (KHÔNG JOIN bảng khác): "
            "shipment_id, order_id, status, delivery_location, delivery_code, created_at, "
            "updated_at, failure_reason. Hệ thống tự lọc chỉ trả đơn của shipper người hỏi, "
            "không cần tự thêm điều kiện shipper_id. Luôn thêm LIMIT hợp lý."
        ),
        "parameters": {
            "type": "OBJECT",
            "required": ["sql"],
            "properties": {
                "sql": {"type": "STRING", "description": "Câu SELECT PostgreSQL trên bảng shipments, chỉ đọc"},
            },
        },
    },
]

_TOOLS_BY_ROLE: dict[str, list] = {
    "admin":   _ADMIN_TOOLS,
    "user":    _USER_TOOLS,
    "shop":    _SHOP_TOOLS,
    "shipper": _SHIPPER_TOOLS,
}


# ── System prompts ─────────────────────────────────────────────────────────────
def _system_prompt(role: str, user: Any) -> str:
    name = getattr(user, "full_name", None) or "bạn"
    base = (
        f"Bạn là trợ lý AI của nền tảng thương mại điện tử BuyZo. "
        f"Người dùng hiện tại tên '{name}', vai trò: {role}. "
        "NGUYÊN TẮC:\n"
        "1. Trả lời bằng tiếng Việt, ngắn gọn và thân thiện.\n"
        "2. Chỉ trả lời câu hỏi liên quan đến BuyZo. Nếu câu hỏi không liên quan, từ chối nhẹ nhàng.\n"
        "3. Khi cần dữ liệu, luôn gọi function — không bịa đặt số liệu. Nếu không có tool cố định "
        "nào khớp câu hỏi, hãy dùng tool *_query_data để tự viết câu SELECT phù hợp.\n"
        "4. Với các hành động ghi DB (hủy đơn, xác nhận đơn, duyệt shop, giải quyết tranh chấp...): "
        "   PHẢI hỏi xác nhận rõ ràng trước khi gọi function, ví dụ: 'Bạn có chắc muốn hủy đơn #123 không?'.\n"
        "5. Sử dụng format markdown đơn giản: **đậm**, danh sách -, số liệu rõ ràng.\n"
    )
    specifics = {
        "admin": (
            "VAI TRÒ: Admin toàn quyền. Được xem toàn bộ dữ liệu hệ thống và thực hiện các hành động quản lý.\n"
            "GIỚI HẠN: Không thực hiện xóa vĩnh viễn tài khoản qua chat. Mọi hành động cần xác nhận rõ ràng."
        ),
        "user": (
            "VAI TRÒ: Khách hàng. Chỉ được xem và thao tác dữ liệu của chính người dùng này.\n"
            "GIỚI HẠN: Không được xem đơn hàng của người khác. Chỉ hủy được đơn 'pending' của bản thân."
        ),
        "shop": (
            "VAI TRÒ: Chủ shop. Chỉ được xem và thao tác dữ liệu shop của người dùng này.\n"
            "GIỚI HẠN: Không được xem dữ liệu shop khác."
        ),
        "shipper": (
            "VAI TRÒ: Shipper. Chỉ được xem và cập nhật đơn giao hàng được phân công cho shipper này.\n"
            "GIỚI HẠN: Không được cập nhật đơn của shipper khác."
        ),
    }
    return base + specifics.get(role, "")


# ── Redis helpers ──────────────────────────────────────────────────────────────
def _redis_client():
    import redis as redis_lib
    return redis_lib.Redis(
        host=settings.REDIS_HOST, port=settings.REDIS_PORT,
        password=settings.REDIS_PASSWORD or None, db=settings.REDIS_DB,
        decode_responses=True, socket_connect_timeout=1,
    )


# ── Tool result cache ──────────────────────────────────────────────────────────
def _cache_key(role: str, user_id: int, fn_name: str, fn_args: dict) -> str:
    raw = json.dumps({"role": role, "uid": user_id, "fn": fn_name, "args": fn_args}, sort_keys=True)
    return "bot:tool:" + hashlib.md5(raw.encode()).hexdigest()


def _get_cache(key: str) -> dict | None:
    try:
        val = _redis_client().get(key)
        return json.loads(val) if val else None
    except Exception:
        return None


def _set_cache(key: str, value: dict, ttl: int = 300) -> None:
    try:
        _redis_client().setex(key, ttl, json.dumps(value))
    except Exception:
        pass


# ── Conversation history (per-user, TTL 30 min) ────────────────────────────────
_HIST_TTL = 1800  # 30 phút


def _hist_key(user_id: int) -> str:
    return f"bot:hist:{user_id}"


def _get_history(user_id: int) -> list[dict]:
    """Load conversation history from Redis. Returns list of {role, text} dicts."""
    try:
        val = _redis_client().get(_hist_key(user_id))
        if val:
            return json.loads(val)
    except Exception:
        pass
    return []


def _save_history(user_id: int, history: list[dict]) -> None:
    """Save conversation history to Redis, keep last 20 exchanges (40 messages)."""
    try:
        # Trim to last 40 messages (20 user + 20 bot)
        trimmed = history[-40:]
        _redis_client().setex(_hist_key(user_id), _HIST_TTL, json.dumps(trimmed))
    except Exception:
        pass


def clear_history(user_id: int) -> None:
    """Delete conversation history for a user."""
    try:
        _redis_client().delete(_hist_key(user_id))
    except Exception:
        pass


# ── Full-reply cache (câu hỏi lặp lại — khỏi gọi Gemini lần nữa) ───────────────
# Khác với cache tool ở trên (chỉ cache KẾT QUẢ TRUY VẤN DB), cache này lưu
# THẲNG câu trả lời cuối cùng đã được model soạn — nếu user hỏi lại y hệt câu
# đã hỏi gần đây thì trả lời ngay, không tốn round-trip gọi Gemini nữa.
# TTL ngắn (90s) vì dữ liệu (đơn hàng, tồn kho...) có thể đổi liên tục.
_REPLY_TTL = 90


def _reply_cache_key(role: str, user_id: int, message: str) -> str:
    norm = " ".join(message.strip().lower().split())
    raw = f"{role}:{user_id}:{norm}"
    return "bot:reply:" + hashlib.md5(raw.encode()).hexdigest()


def _get_reply_cache(key: str) -> str | None:
    try:
        return _redis_client().get(key)
    except Exception:
        return None


def _set_reply_cache(key: str, reply: str) -> None:
    try:
        _redis_client().setex(key, _REPLY_TTL, reply)
    except Exception:
        pass


# ── Main query function ────────────────────────────────────────────────────────
def query_bot(message: str, role: str, user: Any, db: Session) -> str:
    if not settings.GEMINI_API_KEY:
        return "⚠️ Chatbot chưa được cấu hình (thiếu GEMINI_API_KEY). Vui lòng liên hệ Admin."

    import google.generativeai as genai

    genai.configure(api_key=settings.GEMINI_API_KEY)

    tool_defs = _TOOLS_BY_ROLE.get(role)
    if not tool_defs:
        return "Vai trò này chưa được hỗ trợ chatbot."

    # Câu hỏi lặp lại y hệt gần đây (cùng role, cùng user) → trả lời ngay,
    # khỏi gọi Gemini lại từ đầu.
    reply_key = _reply_cache_key(role, user.user_id, message)
    cached_reply = _get_reply_cache(reply_key)
    if cached_reply is not None:
        logger.debug("[bot] reply cache HIT")
        stored_hist = _get_history(user.user_id)
        _save_history(user.user_id, stored_hist + [
            {"role": "user",  "text": message},
            {"role": "model", "text": cached_reply},
        ])
        return cached_reply

    # Load conversation history (text-only, skip tool rounds) — luôn lấy trước
    # try/except để vẫn có stored_hist dùng lưu lịch sử dù có lỗi xảy ra sau đó.
    stored_hist = _get_history(user.user_id)

    MAX_TOOL_ROUNDS = 5
    current_message: Any = message
    final_reply = ""
    used_action_tool = False

    try:
        # Build Gemini tool object
        gemini_tools = genai.protos.Tool(
            function_declarations=[
                genai.protos.FunctionDeclaration(**t) for t in tool_defs
            ]
        )

        model = genai.GenerativeModel(
            model_name=_model_for_role(role),
            tools=[gemini_tools],
            system_instruction=_system_prompt(role, user),
        )

        gemini_history = [
            {"role": h["role"], "parts": [h["text"]]}
            for h in stored_hist
        ]

        chat = model.start_chat(history=gemini_history)

        for _ in range(MAX_TOOL_ROUNDS):
            response = chat.send_message(current_message)
            candidate = response.candidates[0]

            # Collect all function calls in this turn
            fn_calls = [
                part.function_call
                for part in candidate.content.parts
                if part.function_call.name  # non-empty name = actual call
            ]

            if not fn_calls:
                # No more tool calls — return text
                text_parts = [
                    part.text
                    for part in candidate.content.parts
                    if hasattr(part, "text") and part.text
                ]
                final_reply = "\n".join(text_parts).strip() or "Không có phản hồi."
                break

            # Execute all function calls, build response parts
            fn_response_parts = []
            for fc in fn_calls:
                fn_name = fc.name
                fn_args = dict(fc.args)

                if fn_name in ACTION_TOOLS:
                    used_action_tool = True
                    result = execute_tool(fn_name, fn_args, db, user)
                else:
                    cache_key = _cache_key(role, user.user_id, fn_name, fn_args)
                    cached = _get_cache(cache_key)
                    if cached is not None:
                        result = cached
                        logger.debug(f"[bot] cache HIT: {fn_name}")
                    else:
                        result = execute_tool(fn_name, fn_args, db, user)
                        _set_cache(cache_key, result, ttl=300)

                fn_response_parts.append(
                    genai.protos.Part(
                        function_response=genai.protos.FunctionResponse(
                            name=fn_name,
                            response={"result": result},
                        )
                    )
                )

            # Feed results back as a single Content message
            current_message = genai.protos.Content(
                role="user",
                parts=fn_response_parts,
            )
        else:
            final_reply = "Xin lỗi, tôi không thể xử lý yêu cầu này lúc này."
    except Exception as e:
        from google.api_core.exceptions import ResourceExhausted, NotFound
        if isinstance(e, ResourceExhausted):
            logger.warning("[bot] Gemini quota exceeded (role=%s, user_id=%s): %s", role, user.user_id, e)
            final_reply = "⚠️ Chatbot đang tạm hết lượt sử dụng miễn phí trong ngày, vui lòng thử lại sau ít phút hoặc liên hệ Admin để nâng cấp."
        elif isinstance(e, NotFound):
            # Model bị Google gỡ bỏ / không còn cấp cho project mới — cần đổi _FLASH/_PRO
            # sang model khác (xem https://ai.google.dev/gemini-api/docs/models).
            logger.error("[bot] Gemini model not available (role=%s, user_id=%s): %s", role, user.user_id, e)
            final_reply = "⚠️ Chatbot tạm thời gián đoạn do model AI đang dùng đã ngừng hỗ trợ. Đã ghi nhận, Admin cần cập nhật model mới."
        else:
            logger.exception("[bot] Lỗi khi gọi Gemini / xử lý function-calling (role=%s, user_id=%s, message=%r)",
                              role, user.user_id, message)
            final_reply = "⚠️ Xin lỗi, có lỗi xảy ra khi xử lý câu hỏi này. Bạn thử hỏi lại theo cách khác hoặc thử lại sau ít phút nhé."

    # Câu hỏi thông tin thuần (không ghi DB) → cache thẳng câu trả lời cuối để
    # lần hỏi lại y hệt (trong ít phút) không cần gọi Gemini nữa.
    if final_reply and not used_action_tool:
        _set_reply_cache(reply_key, final_reply)

    # Persist conversation history (user message + bot reply, text only)
    if final_reply:
        updated_hist = stored_hist + [
            {"role": "user",  "text": message},
            {"role": "model", "text": final_reply},
        ]
        _save_history(user.user_id, updated_hist)

    return final_reply
