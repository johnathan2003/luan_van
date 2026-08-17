"""seed 10 sự cố demo cho AI Guardian (1/5/2026 - 18/8/2026)

8 sự cố lịch sử (đã resolved, trải từ 03/05 đến 30/07/2026) + 2 sự cố mới
nhất đang ở trạng thái CHỜ xử lý để demo trực tiếp tính năng duyệt/gộp bản
cập nhật (xem 202608170001_ai_incident_workflow_fields.py):
  - 18/08/2026 01:00 — db_overload (critical) — status='pending_approval',
    có proposed_solution, CHƯA resolved — chờ admin bấm duyệt.
  - 18/08/2026 02:03 — high_latency (warning) — status='scheduled',
    release_batch_date=22/08/2026 (thứ 7 gần nhất) — chờ admin bấm phát
    hành bản cập nhật cuối tuần.

An toàn khi chạy lại: bỏ qua toàn bộ nếu đã có 1 dòng khớp đúng
detected_at của sự cố "scheduled" (mốc thời gian riêng, khó trùng ngẫu nhiên).

Revision ID: 202608170002
Revises: 202608170001 
Create Date: 2026-08-17

"""
from datetime import datetime, date

import sqlalchemy as sa
from alembic import op

revision = '202608170002'
down_revision = '202608170001'
branch_labels = None
depends_on = None

_MARKER_DETECTED_AT = datetime(2026, 8, 18, 2, 3, 0)

ai_incidents = sa.table(
    'ai_incidents',
    sa.column('category', sa.String),
    sa.column('severity', sa.String),
    sa.column('title', sa.String),
    sa.column('root_cause', sa.Text),
    sa.column('actions_taken', sa.JSON),
    sa.column('metrics', sa.JSON),
    sa.column('detected_at', sa.DateTime),
    sa.column('resolved_at', sa.DateTime),
    sa.column('status', sa.String),
    sa.column('proposed_solution', sa.Text),
    sa.column('release_batch_date', sa.Date),
    sa.column('is_seed', sa.Boolean),
)

ROWS = [
    dict(
        category='traffic_spike', severity='warning',
        title='Lưu lượng truy cập bất thường từ IP 118.70.12.45',
        root_cause=(
            'Phát hiện 620 request/phút từ IP 118.70.12.45 vào /api/v1/products, cao gấp 13.8x '
            'mức bình thường (45 request/phút). Không có khoảng nghỉ tự nhiên giữa các lần gọi '
            'như thao tác của người dùng thật — nghi ngờ bot/script tự động.'
        ),
        actions_taken=[
            'Ghi nhận IP 118.70.12.45 vào danh sách theo dõi',
            'Áp dụng giới hạn tốc độ (rate limit) cho IP này',
            'Tự động chặn tạm thời trong 30 phút',
            'Theo dõi lưu lượng sau khi chặn — hệ thống đã ổn định trở lại',
        ],
        metrics={'ip': '118.70.12.45', 'endpoint': '/api/v1/products', 'request_count': 620, 'baseline': 45, 'block_minutes': 30},
        detected_at=datetime(2026, 5, 3, 8, 14), resolved_at=datetime(2026, 5, 3, 8, 49),
        status='resolved', proposed_solution=None, release_batch_date=None,
    ),
    dict(
        category='brute_force', severity='critical',
        title='Nghi vấn dò mật khẩu tài khoản po***@gmail.com',
        root_cause=(
            'Tài khoản po***@gmail.com bị đăng nhập sai 52 lần liên tiếp trong 4 phút, cùng từ '
            'IP 91.240.118.33 — dấu hiệu điển hình của tấn công dò mật khẩu tự động.'
        ),
        actions_taken=[
            'Tạm khoá đăng nhập tài khoản trong 20 phút',
            'Chặn IP 91.240.118.33 khỏi endpoint đăng nhập',
            'Ghi log chi tiết để đối chiếu nếu cần điều tra thêm',
            'Không phát hiện đăng nhập thành công từ IP này — tài khoản an toàn',
        ],
        metrics={'username_masked': 'po***@gmail.com', 'fail_count': 52, 'duration_minutes': 4, 'ip': '91.240.118.33', 'lock_minutes': 20},
        detected_at=datetime(2026, 5, 18, 23, 47), resolved_at=datetime(2026, 5, 19, 0, 8),
        status='resolved', proposed_solution=None, release_batch_date=None,
    ),
    dict(
        category='db_overload', severity='critical',
        title='Cơ sở dữ liệu quá tải kết nối',
        root_cause=(
            'Số kết nối tới database tăng lên 210 (giới hạn an toàn 100), độ trễ truy vấn trung '
            'bình tăng lên 1450ms. Nguyên nhân: nhiều phiên Flash Sale kết thúc cùng lúc.'
        ),
        actions_taken=[
            'Kích hoạt connection pool dự phòng',
            'Tạm hoãn các tác vụ nền không khẩn cấp (báo cáo, đồng bộ dữ liệu)',
            'Ưu tiên cache cho các truy vấn lặp lại nhiều nhất',
            'Hệ thống ổn định trở lại sau 5 phút',
        ],
        metrics={'connections': 210, 'limit': 100, 'latency_ms': 1450, 'reason': 'nhiều phiên Flash Sale kết thúc cùng lúc', 'recovery_minutes': 5},
        detected_at=datetime(2026, 6, 2, 20, 5), resolved_at=datetime(2026, 6, 2, 20, 10),
        status='resolved', proposed_solution=None, release_batch_date=None,
    ),
    dict(
        category='high_latency', severity='warning',
        title='Độ trễ phản hồi bất thường tại /api/v1/orders',
        root_cause=(
            'Thời gian phản hồi trung bình tại /api/v1/orders tăng lên 3900ms, so với mức bình '
            'thường 190ms — vượt ngưỡng cảnh báo.'
        ),
        actions_taken=[
            'Ghi nhận endpoint /api/v1/orders vào diện theo dõi sát',
            'Giảm tải bằng cách ưu tiên request đang xử lý dở',
            'Kiểm tra và giải phóng các tiến trình treo (nếu có)',
            'Độ trễ trở lại bình thường sau 3 phút',
        ],
        metrics={'endpoint': '/api/v1/orders', 'latency_ms': 3900, 'normal_ms': 190, 'recovery_minutes': 3},
        detected_at=datetime(2026, 6, 14, 13, 22), resolved_at=datetime(2026, 6, 14, 13, 25),
        status='resolved', proposed_solution=None, release_batch_date=None,
    ),
    dict(
        category='auto_scale', severity='info',
        title='Tự động mở rộng tài nguyên cho Flash Sale khung 20:00',
        root_cause=(
            'Phiên Flash Sale khung 20:00 sắp mở, dự đoán lưu lượng truy cập tăng cao dựa trên '
            'lịch sử các phiên trước — chủ động mở rộng tài nguyên trước khi tải tăng thay vì '
            'đợi phản ứng.'
        ),
        actions_taken=[
            'Tự động tăng số lượng container backend từ 2 lên 6',
            'Kiểm tra sức khoẻ (health check) các container mới',
            'Sẵn sàng phục vụ trước 15 phút so với giờ mở phiên',
            'Tự động thu nhỏ lại về mức bình thường sau khi qua giờ cao điểm',
        ],
        metrics={'slot_name': 'Flash Sale khung 20:00', 'before': 2, 'after': 6, 'minutes_before': 15},
        detected_at=datetime(2026, 6, 28, 19, 45), resolved_at=datetime(2026, 6, 28, 21, 10),
        status='resolved', proposed_solution=None, release_batch_date=None,
    ),
    dict(
        category='traffic_spike', severity='warning',
        title='Lưu lượng truy cập bất thường từ IP 203.162.4.88',
        root_cause=(
            'Phát hiện 540 request/phút từ IP 203.162.4.88 vào /api/v1/auth/login, cao gấp 18.0x '
            'mức bình thường (30 request/phút). Không có khoảng nghỉ tự nhiên giữa các lần gọi '
            'như thao tác của người dùng thật — nghi ngờ bot/script tự động.'
        ),
        actions_taken=[
            'Ghi nhận IP 203.162.4.88 vào danh sách theo dõi',
            'Áp dụng giới hạn tốc độ (rate limit) cho IP này',
            'Tự động chặn tạm thời trong 45 phút',
            'Theo dõi lưu lượng sau khi chặn — hệ thống đã ổn định trở lại',
        ],
        metrics={'ip': '203.162.4.88', 'endpoint': '/api/v1/auth/login', 'request_count': 540, 'baseline': 30, 'block_minutes': 45},
        detected_at=datetime(2026, 7, 5, 2, 31), resolved_at=datetime(2026, 7, 5, 3, 17),
        status='resolved', proposed_solution=None, release_batch_date=None,
    ),
    dict(
        category='brute_force', severity='critical',
        title='Nghi vấn dò mật khẩu tài khoản shop***@buyzo.com',
        root_cause=(
            'Tài khoản shop***@buyzo.com bị đăng nhập sai 38 lần liên tiếp trong 2 phút, cùng từ '
            'IP 45.32.109.6 — dấu hiệu điển hình của tấn công dò mật khẩu tự động.'
        ),
        actions_taken=[
            'Tạm khoá đăng nhập tài khoản trong 15 phút',
            'Chặn IP 45.32.109.6 khỏi endpoint đăng nhập',
            'Ghi log chi tiết để đối chiếu nếu cần điều tra thêm',
            'Không phát hiện đăng nhập thành công từ IP này — tài khoản an toàn',
        ],
        metrics={'username_masked': 'shop***@buyzo.com', 'fail_count': 38, 'duration_minutes': 2, 'ip': '45.32.109.6', 'lock_minutes': 15},
        detected_at=datetime(2026, 7, 19, 10, 12), resolved_at=datetime(2026, 7, 19, 10, 27),
        status='resolved', proposed_solution=None, release_batch_date=None,
    ),
    dict(
        category='auto_scale', severity='info',
        title='Tự động mở rộng tài nguyên cho Mở bán iPhone 17 series',
        root_cause=(
            'Phiên Mở bán iPhone 17 series sắp mở, dự đoán lưu lượng truy cập tăng cao dựa trên '
            'lịch sử các phiên trước — chủ động mở rộng tài nguyên trước khi tải tăng thay vì '
            'đợi phản ứng.'
        ),
        actions_taken=[
            'Tự động tăng số lượng container backend từ 3 lên 8',
            'Kiểm tra sức khoẻ (health check) các container mới',
            'Sẵn sàng phục vụ trước 20 phút so với giờ mở phiên',
            'Tự động thu nhỏ lại về mức bình thường sau khi qua giờ cao điểm',
        ],
        metrics={'slot_name': 'Mở bán iPhone 17 series', 'before': 3, 'after': 8, 'minutes_before': 20},
        detected_at=datetime(2026, 7, 30, 21, 40), resolved_at=datetime(2026, 7, 30, 23, 5),
        status='resolved', proposed_solution=None, release_batch_date=None,
    ),
    # ── 2 sự cố mới nhất — đang CHỜ xử lý, để demo trực tiếp nút duyệt/phát hành ──
    dict(
        category='db_overload', severity='critical',
        title='Cơ sở dữ liệu quá tải kết nối',
        root_cause=(
            'Số kết nối tới database tăng lên 235 (giới hạn an toàn 100), độ trễ truy vấn trung '
            'bình tăng lên 1680ms. Nguyên nhân: lượng đơn hàng tăng đột biến vào khung giờ khuya.'
        ),
        actions_taken=[
            'Kích hoạt connection pool dự phòng',
            'Tạm hoãn các tác vụ nền không khẩn cấp (báo cáo, đồng bộ dữ liệu)',
            'Đã chặn tạm thời các truy vấn nặng để hạ nhiệt hệ thống',
            '⏳ Đã đề xuất giải pháp lâu dài — đang chờ admin duyệt trước khi triển khai chính thức',
        ],
        metrics={'connections': 235, 'limit': 100, 'latency_ms': 1680, 'reason': 'lượng đơn hàng tăng đột biến vào khung giờ khuya'},
        detected_at=datetime(2026, 8, 18, 1, 0), resolved_at=None,
        status='pending_approval',
        proposed_solution=(
            'Đề xuất: tăng giới hạn connection pool lên 250 kết nối đồng thời, đồng thời bật cơ '
            'chế tự động ngắt các kết nối treo quá 30 giây (idle timeout) để tránh tái diễn. Cần '
            'admin duyệt trước khi áp dụng vào hệ thống chính thức.'
        ),
        release_batch_date=None,
    ),
    dict(
        category='high_latency', severity='warning',
        title='Độ trễ phản hồi bất thường tại /api/v1/search',
        root_cause=(
            'Thời gian phản hồi trung bình tại /api/v1/search tăng lên 2800ms, so với mức bình '
            'thường 150ms — vượt ngưỡng cảnh báo.'
        ),
        actions_taken=[
            'Ghi nhận endpoint /api/v1/search vào diện theo dõi sát',
            'Đã áp dụng bản vá tạm thời (tối ưu lại truy vấn tìm kiếm)',
            'Độ trễ đã giảm về mức ổn định — bản vá chính thức sẽ gộp vào bản cập nhật cuối tuần',
        ],
        metrics={'endpoint': '/api/v1/search', 'latency_ms': 2800, 'normal_ms': 150},
        detected_at=_MARKER_DETECTED_AT, resolved_at=None,
        status='scheduled', proposed_solution=None,
        release_batch_date=date(2026, 8, 22),
    ),
]


def upgrade() -> None:
    conn = op.get_bind()
    exists = conn.execute(
        sa.text("SELECT 1 FROM ai_incidents WHERE detected_at = :d"),
        {"d": _MARKER_DETECTED_AT},
    ).first()
    if exists:
        return

    op.bulk_insert(ai_incidents, [{**row, 'is_seed': True} for row in ROWS])


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM ai_incidents WHERE detected_at = :d"), {"d": _MARKER_DETECTED_AT})
