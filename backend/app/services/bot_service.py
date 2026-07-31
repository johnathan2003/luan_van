"""
Bot service — Google Gemini API với function calling.
Model: gemini-1.5-flash cho user/shop/shipper, gemini-1.5-pro cho admin.
Cache kết quả tool qua Redis (TTL 5 phút).
"""
from __future__ import annotations
import hashlib
import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.config import settings
from app.services.bot_tools import execute_tool

logger = logging.getLogger(__name__)

# ── Model selection ────────────────────────────────────────────────────────────
_FLASH = "gemini-1.5-flash"
_PRO   = "gemini-1.5-pro"

def _model_for_role(role: str) -> str:
    return _PRO if role == "admin" else _FLASH


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
                "status": {"type": "STRING", "description": "active | pending | suspended | rejected"},
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
                "status": {"type": "STRING", "description": "pending | confirmed | delivering | delivered | cancelled"},
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
                "status": {"type": "STRING", "description": "open | resolved | rejected"},
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
]

_SHIPPER_TOOLS = [
    {
        "name": "shipper_get_deliveries",
        "description": "Xem danh sách đơn giao hàng của shipper theo trạng thái.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "status": {"type": "STRING", "description": "assigned | picking_up | picked_up | in_transit | delivered | failed"},
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
        "name": "shipper_update_delivery",
        "description": "Cập nhật trạng thái đơn giao hàng theo chiều hợp lệ.",
        "parameters": {
            "type": "OBJECT",
            "required": ["delivery_id", "status"],
            "properties": {
                "delivery_id": {"type": "INTEGER"},
                "status":      {"type": "STRING", "description": "picking_up | picked_up | in_transit | delivered | failed"},
                "note":        {"type": "STRING", "description": "Lý do (bắt buộc khi báo failed)"},
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
        f"Người dùng tên {name}, vai trò: {role}. "
        "Trả lời bằng tiếng Việt, ngắn gọn và thân thiện. "
        "Chỉ trả lời các câu hỏi liên quan đến hệ thống BuyZo. "
        "Khi cần dữ liệu hãy gọi function được cung cấp. "
        "Không bịa đặt số liệu — chỉ dùng kết quả từ function call. "
        "Nếu câu hỏi không liên quan đến hệ thống, hãy từ chối nhẹ nhàng và hướng dẫn người dùng hỏi đúng chủ đề. "
    )
    specifics = {
        "admin":   "Bạn có quyền xem toàn bộ dữ liệu hệ thống. Không thực hiện thao tác xóa/ban qua chat.",
        "user":    "Chỉ xem dữ liệu của chính người dùng này (đơn hàng, voucher). Sản phẩm có thể tìm kiếm tự do.",
        "shop":    "Chỉ xem dữ liệu của shop thuộc sở hữu người dùng này.",
        "shipper": "Chỉ xem đơn giao hàng của shipper này. Được phép cập nhật trạng thái giao hàng.",
    }
    return base + specifics.get(role, "")


# ── Redis cache ────────────────────────────────────────────────────────────────
def _cache_key(role: str, user_id: int, fn_name: str, fn_args: dict) -> str:
    raw = json.dumps({"role": role, "uid": user_id, "fn": fn_name, "args": fn_args}, sort_keys=True)
    return "bot:tool:" + hashlib.md5(raw.encode()).hexdigest()


def _get_cache(key: str) -> dict | None:
    try:
        import redis as redis_lib
        r = redis_lib.Redis(
            host=settings.REDIS_HOST, port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD or None, db=settings.REDIS_DB,
            decode_responses=True, socket_connect_timeout=1,
        )
        val = r.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None


def _set_cache(key: str, value: dict, ttl: int = 300) -> None:
    try:
        import redis as redis_lib
        r = redis_lib.Redis(
            host=settings.REDIS_HOST, port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD or None, db=settings.REDIS_DB,
            decode_responses=True, socket_connect_timeout=1,
        )
        r.setex(key, ttl, json.dumps(value))
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

    chat = model.start_chat()

    MAX_TOOL_ROUNDS = 5
    current_message: Any = message

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
            return "\n".join(text_parts).strip() or "Không có phản hồi."

        # Execute all function calls, build response parts
        fn_response_parts = []
        for fc in fn_calls:
            fn_name = fc.name
            fn_args = dict(fc.args)

            cache_key = _cache_key(role, user.user_id, fn_name, fn_args)
            cached = _get_cache(cache_key)

            if cached is not None:
                result = cached
                logger.debug(f"[bot] cache HIT: {fn_name}")
            else:
                result = execute_tool(fn_name, fn_args, db, user)
                if "update" not in fn_name:
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

    return "Xin lỗi, tôi không thể xử lý yêu cầu này lúc này."
