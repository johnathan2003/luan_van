"""add owner_notified and assigned_employee_id to conversations

Revision ID: 202406240002
Revises: 202406240001
Create Date: 2024-06-24 00:00:02
"""
from alembic import op
import sqlalchemy as sa

revision = '202406240002'
down_revision = '202406240001'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    cols = [row[0] for row in conn.execute(
        sa.text("SELECT column_name FROM information_schema.columns WHERE table_name='conversations'")
    )]

    if 'owner_notified' not in cols:
        op.add_column('conversations', sa.Column(
            'owner_notified', sa.Boolean(), nullable=False, server_default='false'
        ))

    if 'assigned_employee_id' not in cols:
        op.add_column('conversations', sa.Column(
            'assigned_employee_id', sa.Integer(), nullable=True
        ))
        # ForeignKey phải dùng create_foreign_key riêng (không thể nhúng vào add_column)
        op.create_foreign_key(
            'fk_conv_assigned_employee',
            'conversations', 'users',
            ['assigned_employee_id'], ['user_id'],
            ondelete='SET NULL',
        )


def downgrade():
    op.drop_constraint('fk_conv_assigned_employee', 'conversations', type_='foreignkey')
    op.drop_column('conversations', 'assigned_employee_id')
    op.drop_column('conversations', 'owner_notified')
