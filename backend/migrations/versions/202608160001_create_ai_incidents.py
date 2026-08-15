"""create ai_incidents table

Nhật ký sự cố hệ thống do "AI" phát hiện + tự xử lý — phần trình bày AI như
một người bảo vệ luôn túc trực (xem app/models/ai_incident.py).

Revision ID: 202608160001
Revises: 202608150001
Create Date: 2026-08-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '202608160001'
down_revision = '202608150001'
branch_labels = None
depends_on = None


def _table_exists(conn, table) -> bool:
    return conn.execute(text("""
        SELECT 1 FROM information_schema.tables WHERE table_name = :t
    """), {"t": table}).first() is not None


def upgrade() -> None:
    conn = op.get_bind()
    if _table_exists(conn, 'ai_incidents'):
        return

    op.create_table(
        'ai_incidents',
        sa.Column('incident_id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('severity', sa.String(20), nullable=False, server_default='warning'),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('root_cause', sa.Text(), nullable=False),
        sa.Column('actions_taken', sa.JSON(), nullable=False),
        sa.Column('metrics', sa.JSON(), nullable=True),
        sa.Column('detected_at', sa.DateTime(), nullable=False),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='resolved'),
        sa.Column('is_seed', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.user_id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('idx_ai_incidents_detected', 'ai_incidents', ['detected_at'])
    op.create_index('idx_ai_incidents_category', 'ai_incidents', ['category'])


def downgrade() -> None:
    op.drop_table('ai_incidents')
