"""add status and suspended_reason to shops

Revision ID: 202608030001
Revises: 202608020002
Create Date: 2026-08-03

"""
from alembic import op
import sqlalchemy as sa

revision = '202608030001'
down_revision = '202608020002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('shops', sa.Column(
        'status',
        sa.Enum('active', 'suspended', 'banned', name='shop_status_enum'),
        nullable=False,
        server_default='active',
    ))
    op.add_column('shops', sa.Column('suspended_reason', sa.Text(), nullable=True))
    op.add_column('shops', sa.Column('suspended_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('shops', 'suspended_at')
    op.drop_column('shops', 'suspended_reason')
    op.drop_column('shops', 'status')
