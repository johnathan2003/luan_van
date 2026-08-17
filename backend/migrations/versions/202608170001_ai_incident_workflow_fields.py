"""thêm luồng duyệt/gộp bản cập nhật cho ai_incidents

Lỗi nhỏ (info/warning) coi như AI tự vá ngay nhưng gộp chờ phát hành cuối
tuần (status='scheduled', release_batch_date). Lỗi nghiêm trọng (critical)
AI chỉ đề xuất giải pháp (proposed_solution), chờ admin duyệt
(status='pending_approval' -> 'resolved', approved_by/approved_at) rồi mới
coi là đã đưa lên hệ thống chính thức. Xem app/models/ai_incident.py.

Revision ID: 202608170001
Revises: 202608160006
Create Date: 2026-08-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '202608170001'
down_revision = '202608160006'
branch_labels = None
depends_on = None


def _column_exists(conn, table, column) -> bool:
    return conn.execute(text("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = :t AND column_name = :c
    """), {"t": table, "c": column}).first() is not None


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, 'ai_incidents', 'proposed_solution'):
        op.add_column('ai_incidents', sa.Column('proposed_solution', sa.Text(), nullable=True))
    if not _column_exists(conn, 'ai_incidents', 'release_batch_date'):
        op.add_column('ai_incidents', sa.Column('release_batch_date', sa.Date(), nullable=True))
    if not _column_exists(conn, 'ai_incidents', 'approved_by'):
        op.add_column('ai_incidents', sa.Column(
            'approved_by', sa.Integer(),
            sa.ForeignKey('users.user_id', ondelete='SET NULL'), nullable=True,
        ))
    if not _column_exists(conn, 'ai_incidents', 'approved_at'):
        op.add_column('ai_incidents', sa.Column('approved_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('ai_incidents', 'approved_at')
    op.drop_column('ai_incidents', 'approved_by')
    op.drop_column('ai_incidents', 'release_batch_date')
    op.drop_column('ai_incidents', 'proposed_solution')
