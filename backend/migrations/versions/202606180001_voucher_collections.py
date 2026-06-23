"""Add voucher_collections table (user voucher wallet)

Revision ID: 202606180001
Revises: 202606010916
Create Date: 2026-06-18
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '202606180001'
down_revision: Union[str, None] = '202606010916'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('voucher_collections',
        sa.Column('collection_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.user_id', ondelete='CASCADE'), nullable=False),
        sa.Column('voucher_id', sa.Integer(), sa.ForeignKey('vouchers.voucher_id', ondelete='CASCADE'), nullable=False),
        sa.Column('collected_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
        sa.UniqueConstraint('user_id', 'voucher_id', name='uq_user_voucher_collection'),
    )
    op.create_index('idx_voucher_collection_user', 'voucher_collections', ['user_id'])


def downgrade() -> None:
    op.drop_index('idx_voucher_collection_user', table_name='voucher_collections')
    op.drop_table('voucher_collections')
