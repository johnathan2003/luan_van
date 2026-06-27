"""add admin config tables (banners, feedbacks, shipping_zones, shipping_methods, platform_transactions)

Revision ID: 202606250002
Revises: 202606250001
Create Date: 2026-06-25

"""
from alembic import op
import sqlalchemy as sa

revision = '202606250002'
down_revision = '202606250001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── banners ────────────────────────────────────────────────────────────────
    op.create_table(
        'banners',
        sa.Column('banner_id',     sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title',         sa.String(200), nullable=False),
        sa.Column('shop_id',       sa.Integer(), nullable=True),
        sa.Column('shop_name',     sa.String(200), nullable=True),
        sa.Column('status',        sa.Enum('pending', 'active', 'rejected', name='banner_status'), server_default='pending'),
        sa.Column('valid_from',    sa.String(20), nullable=True),
        sa.Column('valid_to',      sa.String(20), nullable=True),
        sa.Column('link',          sa.String(500), nullable=True),
        sa.Column('image_url',     sa.String(500), nullable=True),
        sa.Column('emoji',         sa.String(20), nullable=True),
        sa.Column('color1',        sa.String(20), nullable=True),
        sa.Column('color2',        sa.String(20), nullable=True),
        sa.Column('display_order', sa.Integer(), server_default='0'),
        sa.Column('created_at',    sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at',    sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('banner_id'),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.shop_id'], ondelete='SET NULL'),
    )
    op.create_index('idx_banner_status', 'banners', ['status'])

    # ── feedbacks ──────────────────────────────────────────────────────────────
    op.create_table(
        'feedbacks',
        sa.Column('feedback_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id',     sa.Integer(), nullable=True),
        sa.Column('user_name',   sa.String(100), nullable=True),
        sa.Column('user_email',  sa.String(200), nullable=True),
        sa.Column('subject',     sa.String(300), nullable=False),
        sa.Column('content',     sa.Text(), nullable=False),
        sa.Column('type',        sa.Enum('bug', 'complaint', 'suggestion', 'praise', 'other', name='feedback_type'), server_default='other'),
        sa.Column('status',      sa.Enum('open', 'in_progress', 'resolved', 'closed', name='feedback_status'), server_default='open'),
        sa.Column('admin_note',  sa.Text(), nullable=True),
        sa.Column('created_at',  sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at',  sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('feedback_id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='SET NULL'),
    )
    op.create_index('idx_feedback_status', 'feedbacks', ['status'])
    op.create_index('idx_feedback_type',   'feedbacks', ['type'])

    # ── shipping_zones ─────────────────────────────────────────────────────────
    op.create_table(
        'shipping_zones',
        sa.Column('zone_id',        sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name',           sa.String(100), nullable=False),
        sa.Column('provinces',      sa.String(500), nullable=True),
        sa.Column('base_fee',       sa.Numeric(10, 0), server_default='0'),
        sa.Column('per_kg',         sa.Numeric(10, 0), server_default='0'),
        sa.Column('estimated_days', sa.String(20), nullable=True),
        sa.Column('is_active',      sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at',     sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at',     sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('zone_id'),
    )

    # ── shipping_methods ───────────────────────────────────────────────────────
    op.create_table(
        'shipping_methods',
        sa.Column('method_id',   sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name',        sa.String(100), nullable=False),
        sa.Column('code',        sa.String(50), nullable=False),
        sa.Column('description', sa.String(300), nullable=True),
        sa.Column('is_active',   sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at',  sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at',  sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('method_id'),
        sa.UniqueConstraint('code', name='uq_shipping_method_code'),
    )

    # ── platform_transactions ──────────────────────────────────────────────────
    op.create_table(
        'platform_transactions',
        sa.Column('txn_id',    sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('type',      sa.Enum('commission', 'refund', 'payout', 'adjustment', name='platform_txn_type'), nullable=False),
        sa.Column('amount',    sa.Numeric(14, 2), nullable=False),
        sa.Column('shop_id',   sa.Integer(), nullable=True),
        sa.Column('shop_name', sa.String(200), nullable=True),
        sa.Column('order_id',  sa.Integer(), nullable=True),
        sa.Column('status',    sa.Enum('completed', 'pending', 'cancelled', name='platform_txn_status'), server_default='completed'),
        sa.Column('note',      sa.String(300), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('txn_id'),
        sa.ForeignKeyConstraint(['shop_id'],  ['shops.shop_id'],   ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['order_id'], ['orders.order_id'], ondelete='SET NULL'),
    )
    op.create_index('idx_ptxn_type',    'platform_transactions', ['type'])
    op.create_index('idx_ptxn_created', 'platform_transactions', ['created_at'])


def downgrade() -> None:
    op.drop_table('platform_transactions')
    op.drop_table('shipping_methods')
    op.drop_table('shipping_zones')
    op.drop_table('feedbacks')
    op.drop_table('banners')
    op.execute('DROP TYPE IF EXISTS platform_txn_status')
    op.execute('DROP TYPE IF EXISTS platform_txn_type')
    op.execute('DROP TYPE IF EXISTS feedback_status')
    op.execute('DROP TYPE IF EXISTS feedback_type')
    op.execute('DROP TYPE IF EXISTS banner_status')
