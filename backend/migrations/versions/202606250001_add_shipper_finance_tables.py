"""add shipper finance tables (transactions, withdrawals, incidents)

Revision ID: 202606250001
Revises: 202606230001
Create Date: 2026-06-25

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '202606250001'
down_revision = '202406240002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── shipper_bonuses ────────────────────────────────────────────────────────
    op.create_table(
        'shipper_bonuses',
        sa.Column('bonus_id',    sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('shipper_id',  sa.Integer(), nullable=False),
        sa.Column('type',        sa.String(50), nullable=False),   # weekly_target, 5star_rating, milestone, …
        sa.Column('title',       sa.String(200), nullable=False),
        sa.Column('reward',      sa.Numeric(12, 2), nullable=False),
        sa.Column('period',      sa.String(100), nullable=True),
        sa.Column('status',      sa.Enum('received', 'pending', 'cancelled', name='shipper_bonus_status'), server_default='pending'),
        sa.Column('received_at', sa.DateTime(), nullable=True),
        sa.Column('created_at',  sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('bonus_id'),
        sa.ForeignKeyConstraint(['shipper_id'], ['shippers.shipper_id'], ondelete='CASCADE'),
    )
    op.create_index('idx_sbonus_shipper', 'shipper_bonuses', ['shipper_id'])

    # ── shipper_transactions ───────────────────────────────────────────────────
    op.create_table(
        'shipper_transactions',
        sa.Column('txn_id',     sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('shipper_id', sa.Integer(), nullable=False),
        sa.Column('order_id',   sa.Integer(), nullable=True),
        sa.Column('type',       sa.Enum('delivery_fee', 'bonus', 'adjustment', 'refund', name='shipper_txn_type'), nullable=False),
        sa.Column('amount',     sa.Numeric(12, 2), nullable=False),
        sa.Column('status',     sa.Enum('completed', 'pending', 'cancelled', name='shipper_txn_status'), server_default='completed'),
        sa.Column('note',       sa.String(300), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('txn_id'),
        sa.ForeignKeyConstraint(['shipper_id'], ['shippers.shipper_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['order_id'],   ['orders.order_id'],     ondelete='SET NULL'),
    )
    op.create_index('idx_stxn_shipper',    'shipper_transactions', ['shipper_id'])
    op.create_index('idx_stxn_created',    'shipper_transactions', ['created_at'])

    # ── shipper_withdrawals ────────────────────────────────────────────────────
    op.create_table(
        'shipper_withdrawals',
        sa.Column('wd_id',          sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('shipper_id',     sa.Integer(), nullable=False),
        sa.Column('amount',         sa.Numeric(12, 2), nullable=False),
        sa.Column('bank_name',      sa.String(100), nullable=False),
        sa.Column('account_number', sa.String(50),  nullable=False),
        sa.Column('account_holder', sa.String(100), nullable=True),
        sa.Column('status',         sa.Enum('pending', 'completed', 'rejected', name='shipper_wd_status'), server_default='pending'),
        sa.Column('note',           sa.String(300), nullable=True),
        sa.Column('created_at',     sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('completed_at',   sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('wd_id'),
        sa.ForeignKeyConstraint(['shipper_id'], ['shippers.shipper_id'], ondelete='CASCADE'),
    )
    op.create_index('idx_swd_shipper', 'shipper_withdrawals', ['shipper_id'])

    # ── shipper_incidents ──────────────────────────────────────────────────────
    op.create_table(
        'shipper_incidents',
        sa.Column('incident_id',  sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('shipper_id',   sa.Integer(), nullable=False),
        sa.Column('order_id',     sa.Integer(), nullable=True),
        sa.Column('type',         sa.Enum('accident', 'delay', 'complaint', 'lost_item', 'other', name='shipper_incident_type'), nullable=False),
        sa.Column('title',        sa.String(200), nullable=False),
        sa.Column('description',  sa.Text(), nullable=True),
        sa.Column('status',       sa.Enum('open', 'in_review', 'resolved', 'closed', name='shipper_incident_status'), server_default='open'),
        sa.Column('is_violation', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('support_note', sa.String(500), nullable=True),
        sa.Column('created_at',   sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at',   sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('incident_id'),
        sa.ForeignKeyConstraint(['shipper_id'], ['shippers.shipper_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['order_id'],   ['orders.order_id'],     ondelete='SET NULL'),
    )
    op.create_index('idx_sinc_shipper',    'shipper_incidents', ['shipper_id'])
    op.create_index('idx_sinc_violation',  'shipper_incidents', ['shipper_id', 'is_violation'])


def downgrade() -> None:
    op.drop_table('shipper_incidents')
    op.drop_table('shipper_withdrawals')
    op.drop_table('shipper_transactions')
    op.drop_table('shipper_bonuses')
    op.execute('DROP TYPE IF EXISTS shipper_incident_status')
    op.execute('DROP TYPE IF EXISTS shipper_incident_type')
    op.execute('DROP TYPE IF EXISTS shipper_wd_status')
    op.execute('DROP TYPE IF EXISTS shipper_txn_status')
    op.execute('DROP TYPE IF EXISTS shipper_txn_type')
    op.execute('DROP TYPE IF EXISTS shipper_bonus_status')
