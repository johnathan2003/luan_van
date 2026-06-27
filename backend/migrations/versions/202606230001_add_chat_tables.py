"""add chat tables (conversations + messages)

Revision ID: 202606230001
Revises: 202606180001
Create Date: 2026-06-23

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '202606230001'
down_revision = '202606180001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── conversations ──────────────────────────────────────────────────────────
    op.create_table(
        'conversations',
        sa.Column('conversation_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id',  sa.Integer(), nullable=False),
        sa.Column('shop_id',  sa.Integer(), nullable=False),
        sa.Column('last_message',    sa.Text(),    nullable=True),
        sa.Column('last_message_at', sa.DateTime(), nullable=True),
        sa.Column('unread_by_shop',  sa.Integer(), server_default='0', nullable=False),
        sa.Column('unread_by_user',  sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('conversation_id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['shop_id'], ['shops.shop_id'], ondelete='CASCADE'),
    )
    op.create_index('uq_conv_user_shop',   'conversations', ['user_id', 'shop_id'], unique=True)
    op.create_index('idx_conv_user',       'conversations', ['user_id'])
    op.create_index('idx_conv_shop',       'conversations', ['shop_id'])
    op.create_index('idx_conv_last_msg',   'conversations', ['last_message_at'])

    # ── messages ───────────────────────────────────────────────────────────────
    op.create_table(
        'messages',
        sa.Column('message_id',      sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('conversation_id', sa.Integer(), nullable=False),
        sa.Column('sender_id',       sa.Integer(), nullable=False),
        sa.Column('sender_role',     sa.String(10), nullable=False),   # 'user' | 'shop'
        sa.Column('content',         sa.Text(), nullable=False),
        sa.Column('image_url',       sa.String(500), nullable=True),
        sa.Column('is_read',         sa.Boolean(), server_default='false', nullable=False),
        sa.Column('read_at',         sa.DateTime(), nullable=True),
        sa.Column('created_at',      sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('message_id'),
        sa.ForeignKeyConstraint(
            ['conversation_id'], ['conversations.conversation_id'], ondelete='CASCADE'
        ),
        sa.ForeignKeyConstraint(['sender_id'], ['users.user_id']),
    )
    op.create_index('idx_msg_conv_created', 'messages', ['conversation_id', 'created_at'])
    op.create_index('idx_msg_sender',       'messages', ['sender_id'])


def downgrade() -> None:
    op.drop_table('messages')
    op.drop_table('conversations')
