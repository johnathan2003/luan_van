"""
app/services/ai_incident_service.py
------------------------------------------
Template dựng sẵn cho "nhật ký sự cố AI" — admin chọn loại sự cố, điền số
liệu thật vào các trường được khai báo sẵn, hệ thống tự ráp thành tiêu đề +
nguyên nhân + các bước "đã xử lý" (hiển thị như log console). Không gọi AI
thật (LLM) để tránh phụ thuộc mạng/API key lúc trình bày — nội dung vẫn đọc
tự nhiên vì số liệu là số liệu admin tự nhập, không phải giả toàn bộ.

Mỗi field: {key, label, type ('text'|'number'), default}
Mỗi template: {label, icon, default_severity, fields, title_tpl, root_cause_tpl, actions_tpl}
"""
from typing import Any, Optional


class _SafeDict(dict):
    """Format string thiếu key thì giữ nguyên {key} thay vì raise KeyError —
    phòng trường hợp field optional không được điền."""
    def __missing__(self, key):
        return "{" + key + "}"


TEMPLATES: dict[str, dict[str, Any]] = {
    "traffic_spike": {
        "label": "Lưu lượng bất thường từ 1 IP",
        "icon": "🌐",
        "default_severity": "warning",
        "fields": [
            {"key": "ip", "label": "Địa chỉ IP", "type": "text", "default": "203.113.42.19"},
            {"key": "endpoint", "label": "Endpoint bị dồn tải", "type": "text", "default": "/api/v1/products"},
            {"key": "request_count", "label": "Số request/phút phát hiện", "type": "number", "default": 480},
            {"key": "baseline", "label": "Mức bình thường (request/phút)", "type": "number", "default": 40},
            {"key": "block_minutes", "label": "Thời gian chặn (phút)", "type": "number", "default": 30},
        ],
        "title_tpl": "Lưu lượng truy cập bất thường từ IP {ip}",
        "root_cause_tpl": (
            "Phát hiện {request_count} request/phút từ IP {ip} vào {endpoint}, cao gấp {multiplier}x "
            "mức bình thường ({baseline} request/phút). Không có khoảng nghỉ tự nhiên giữa các lần gọi "
            "như thao tác của người dùng thật — nghi ngờ bot/script tự động."
        ),
        "actions_tpl": [
            "Ghi nhận IP {ip} vào danh sách theo dõi",
            "Áp dụng giới hạn tốc độ (rate limit) cho IP này",
            "Tự động chặn tạm thời trong {block_minutes} phút",
            "Theo dõi lưu lượng sau khi chặn — hệ thống đã ổn định trở lại",
        ],
    },
    "brute_force": {
        "label": "Dò mật khẩu đăng nhập (brute-force)",
        "icon": "🔐",
        "default_severity": "critical",
        "fields": [
            {"key": "username_masked", "label": "Tài khoản bị nhắm tới (đã ẩn 1 phần)", "type": "text", "default": "shop***@gmail.com"},
            {"key": "fail_count", "label": "Số lần đăng nhập sai liên tiếp", "type": "number", "default": 47},
            {"key": "duration_minutes", "label": "Trong vòng (phút)", "type": "number", "default": 3},
            {"key": "ip", "label": "Địa chỉ IP nguồn", "type": "text", "default": "45.89.201.7"},
            {"key": "lock_minutes", "label": "Thời gian khoá tài khoản (phút)", "type": "number", "default": 15},
        ],
        "title_tpl": "Nghi vấn dò mật khẩu tài khoản {username_masked}",
        "root_cause_tpl": (
            "Tài khoản {username_masked} bị đăng nhập sai {fail_count} lần liên tiếp trong "
            "{duration_minutes} phút, cùng từ IP {ip} — dấu hiệu điển hình của tấn công dò mật khẩu tự động."
        ),
        "actions_tpl": [
            "Tạm khoá đăng nhập tài khoản trong {lock_minutes} phút",
            "Chặn IP {ip} khỏi endpoint đăng nhập",
            "Ghi log chi tiết để đối chiếu nếu cần điều tra thêm",
            "Không phát hiện đăng nhập thành công từ IP này — tài khoản an toàn",
        ],
    },
    "db_overload": {
        "label": "Quá tải cơ sở dữ liệu",
        "icon": "🗄️",
        "default_severity": "critical",
        "fields": [
            {"key": "connections", "label": "Số kết nối DB đồng thời", "type": "number", "default": 180},
            {"key": "limit", "label": "Giới hạn an toàn", "type": "number", "default": 100},
            {"key": "latency_ms", "label": "Độ trễ truy vấn trung bình (ms)", "type": "number", "default": 1200},
            {"key": "reason", "label": "Nguyên nhân tăng tải", "type": "text", "default": "nhiều phiên Flash Sale kết thúc cùng lúc"},
            {"key": "recovery_minutes", "label": "Thời gian hồi phục (phút)", "type": "number", "default": 4},
        ],
        "title_tpl": "Cơ sở dữ liệu quá tải kết nối",
        "root_cause_tpl": (
            "Số kết nối tới database tăng lên {connections} (giới hạn an toàn {limit}), độ trễ truy vấn "
            "trung bình tăng lên {latency_ms}ms. Nguyên nhân: {reason}."
        ),
        "actions_tpl": [
            "Kích hoạt connection pool dự phòng",
            "Tạm hoãn các tác vụ nền không khẩn cấp (báo cáo, đồng bộ dữ liệu)",
            "Ưu tiên cache cho các truy vấn lặp lại nhiều nhất",
            "Hệ thống ổn định trở lại sau {recovery_minutes} phút",
        ],
    },
    "high_latency": {
        "label": "Độ trễ phản hồi tăng cao",
        "icon": "🐢",
        "default_severity": "warning",
        "fields": [
            {"key": "endpoint", "label": "Endpoint bị ảnh hưởng", "type": "text", "default": "/api/v1/orders"},
            {"key": "latency_ms", "label": "Độ trễ đo được (ms)", "type": "number", "default": 3400},
            {"key": "normal_ms", "label": "Độ trễ bình thường (ms)", "type": "number", "default": 180},
            {"key": "recovery_minutes", "label": "Thời gian hồi phục (phút)", "type": "number", "default": 2},
        ],
        "title_tpl": "Độ trễ phản hồi bất thường tại {endpoint}",
        "root_cause_tpl": (
            "Thời gian phản hồi trung bình tại {endpoint} tăng lên {latency_ms}ms, so với mức bình "
            "thường {normal_ms}ms — vượt ngưỡng cảnh báo."
        ),
        "actions_tpl": [
            "Ghi nhận endpoint {endpoint} vào diện theo dõi sát",
            "Giảm tải bằng cách ưu tiên request đang xử lý dở",
            "Kiểm tra và giải phóng các tiến trình treo (nếu có)",
            "Độ trễ trở lại bình thường sau {recovery_minutes} phút",
        ],
    },
    "auto_scale": {
        "label": "Tự động mở rộng tài nguyên trước sự kiện sale",
        "icon": "📈",
        "default_severity": "info",
        "fields": [
            {"key": "slot_name", "label": "Tên phiên / sự kiện", "type": "text", "default": "Flash Sale khung 20:00"},
            {"key": "before", "label": "Số container trước khi scale", "type": "number", "default": 2},
            {"key": "after", "label": "Số container sau khi scale", "type": "number", "default": 5},
            {"key": "minutes_before", "label": "Scale trước giờ mở bao nhiêu phút", "type": "number", "default": 15},
        ],
        "title_tpl": "Tự động mở rộng tài nguyên cho {slot_name}",
        "root_cause_tpl": (
            "Phiên {slot_name} sắp mở, dự đoán lưu lượng truy cập tăng cao dựa trên lịch sử các phiên "
            "trước — chủ động mở rộng tài nguyên trước khi tải tăng thay vì đợi phản ứng."
        ),
        "actions_tpl": [
            "Tự động tăng số lượng container backend từ {before} lên {after}",
            "Kiểm tra sức khoẻ (health check) các container mới",
            "Sẵn sàng phục vụ trước {minutes_before} phút so với giờ mở phiên",
            "Tự động thu nhỏ lại về mức bình thường sau khi qua giờ cao điểm",
        ],
    },
    "custom": {
        "label": "Tự soạn nội dung",
        "icon": "📝",
        "default_severity": "warning",
        "fields": [],
        "title_tpl": "{title}",
        "root_cause_tpl": "{root_cause}",
        "actions_tpl": ["{actions}"],
    },
}


def list_templates() -> list[dict]:
    return [
        {"category": key, "label": t["label"], "icon": t["icon"], "default_severity": t["default_severity"], "fields": t["fields"]}
        for key, t in TEMPLATES.items()
    ]


def render_incident(category: str, values: dict, custom: Optional[dict] = None) -> dict:
    """Trả về {title, root_cause, actions_taken: list[str]} đã điền số liệu.
    `custom` dùng riêng cho category='custom' — {title, root_cause, actions: list[str]}."""
    tpl = TEMPLATES.get(category)
    if not tpl:
        raise ValueError(f"Không tồn tại loại sự cố '{category}'")

    if category == "custom":
        c = custom or {}
        return {
            "title": c.get("title") or "Sự cố hệ thống",
            "root_cause": c.get("root_cause") or "",
            "actions_taken": [a for a in (c.get("actions") or []) if a],
        }

    data = _SafeDict(values or {})

    # Trường suy ra (derived) — không phải field nhập tay
    if category == "traffic_spike":
        try:
            rc = float(values.get("request_count", 0))
            bl = float(values.get("baseline", 1)) or 1
            data["multiplier"] = round(rc / bl, 1)
        except (TypeError, ValueError):
            data["multiplier"] = "?"

    title = tpl["title_tpl"].format_map(data)
    root_cause = tpl["root_cause_tpl"].format_map(data)
    actions_taken = [step.format_map(data) for step in tpl["actions_tpl"]]

    return {"title": title, "root_cause": root_cause, "actions_taken": actions_taken}
