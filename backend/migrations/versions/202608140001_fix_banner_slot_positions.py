"""fix banner_slots.position để khớp với vị trí frontend thực tế đang gọi

banner_slots được seed ban đầu (202607160001) với position = top/middle/
sidebar/category — nhưng Home.tsx thực tế gọi GET /banners/live?position=
với 4 key khác hẳn: home_slider / mall_ads_main / mall_ads_fixed /
mall_banner (slider chính trang chủ + 2 khu quảng cáo Mall + banner Mall
trái). Do KHÔNG có slot nào khớp key thật, admin không thể tạo/duyệt banner
nào hiển thị lên các vị trí này — trang chủ luôn fallback về ảnh tĩnh.

Đổi 4 slot đã seed sẵn sang đúng key, đồng thời refresh lại "banners" đã
promote trước đó (nếu có) cho khớp — an toàn, không mất dữ liệu.

Revision ID: 202608140001
Revises: 202608080005
Create Date: 2026-08-14

"""
from alembic import op
from sqlalchemy import text

revision = '202608140001'
down_revision = '202608080005'
branch_labels = None
depends_on = None

_MAP = {
    'top':      'home_slider',    # Banner chính trang chủ (slider)
    'middle':   'mall_ads_main',  # Banner phụ trang chủ -> khu quảng cáo Mall (trái, 7 phần)
    'sidebar':  'mall_ads_fixed', # Banner sidebar phải -> khu quảng cáo Mall (phải, 3 phần)
    'category': 'mall_banner',    # Banner danh mục -> Banner Mall (panel trái, "Hình 4")
}


def upgrade() -> None:
    conn = op.get_bind()

    for old, new in _MAP.items():
        conn.execute(
            text("UPDATE banner_slots SET position = :new WHERE position = :old"),
            {"new": new, "old": old},
        )

    # Banner đã promote trước đó (nếu có) đang cache position cũ -> refresh cho khớp slot
    conn.execute(text("""
        UPDATE banners b
        SET position = bs.position
        FROM banner_slots bs
        WHERE b.slot_id = bs.slot_id AND b.position IS DISTINCT FROM bs.position
    """))


def downgrade() -> None:
    conn = op.get_bind()
    for old, new in _MAP.items():
        conn.execute(
            text("UPDATE banner_slots SET position = :old WHERE position = :new"),
            {"old": old, "new": new},
        )
