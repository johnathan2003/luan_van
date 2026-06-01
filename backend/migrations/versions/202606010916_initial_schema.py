"""Initial schema

Revision ID: 202606010916
Revises:
Create Date: 2026-06-01T09:16:18.706268
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '202606010916'
down_revision: Union[str, None] = '202606010915'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('roles',
        sa.Column('role_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('role_name', sa.String(100), unique=True, nullable=False),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('permissions',
        sa.Column('permission_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('permission_code', sa.String(100), unique=True, nullable=False),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('category', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('users',
        sa.Column('user_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('address', sa.String(255), nullable=True),
        sa.Column('avatar_url', sa.String(500), nullable=True),
        sa.Column('status', sa.String(50), nullable=True),
        sa.Column('last_login', sa.DateTime(timezone=False), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('user_roles',
        sa.Column('user_role_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('role_id', sa.Integer(), sa.ForeignKey('roles.role_id'), nullable=False),
        sa.Column('status', sa.String(50), nullable=True),
        sa.Column('current_role', sa.Boolean(), nullable=True),
        sa.Column('assigned_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column('assigned_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
        sa.UniqueConstraint('user_id', 'role_id', name='unique_user_role'),
    )
    op.create_table('role_permissions',
        sa.Column('role_perm_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('role_id', sa.Integer(), sa.ForeignKey('roles.role_id'), nullable=False),
        sa.Column('permission_id', sa.Integer(), sa.ForeignKey('permissions.permission_id'), nullable=False),
        sa.UniqueConstraint('role_id', 'permission_id', name='unique_role_permission'),
    )
    op.create_table('product_categories',
        sa.Column('category_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('category_name', sa.String(255), unique=True, nullable=False),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('icon_url', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('shops',
        sa.Column('shop_id', sa.Integer(), sa.ForeignKey('users.user_id'), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('shop_name', sa.String(255), nullable=False),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('avatar_url', sa.String(500), nullable=True),
        sa.Column('address', sa.String(255), nullable=False),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('rating', sa.String(5), nullable=True),
        sa.Column('total_followers', sa.Integer(), nullable=True),
        sa.Column('total_orders', sa.Integer(), nullable=True),
        sa.Column('verification_status', sa.String(50), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=False), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('shop_registrations',
        sa.Column('reg_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.user_id'), unique=True, nullable=False),
        sa.Column('shop_name', sa.String(255), nullable=False),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('address', sa.String(255), nullable=False),
        sa.Column('cmnd_url', sa.String(500), nullable=True),
        sa.Column('cmnd_back_url', sa.String(500), nullable=True),
        sa.Column('business_reg_url', sa.String(500), nullable=True),
        sa.Column('status', sa.String(50), nullable=True),
        sa.Column('rejection_reason', sa.String(255), nullable=True),
        sa.Column('reviewed_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=False), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('shop_employees',
        sa.Column('employee_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.user_id'), unique=True, nullable=False),
        sa.Column('shop_id', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('employee_name', sa.String(255), nullable=True),
        sa.Column('position', sa.String(100), nullable=True),
        sa.Column('status', sa.String(50), nullable=True),
        sa.Column('hired_date', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('employee_role_permissions',
        sa.Column('emp_perm_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('employee_id', sa.Integer(), sa.ForeignKey('shop_employees.employee_id'), nullable=False),
        sa.Column('permission_code', sa.String(100), nullable=False),
        sa.Column('granted_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('granted_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('system_employees',
        sa.Column('emp_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.user_id'), unique=True, nullable=False),
        sa.Column('emp_name', sa.String(255), nullable=True),
        sa.Column('role_name', sa.String(50), nullable=True),
        sa.Column('status', sa.String(50), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('system_employee_permissions',
        sa.Column('emp_perm_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('emp_id', sa.Integer(), sa.ForeignKey('system_employees.emp_id'), nullable=False),
        sa.Column('permission_code', sa.String(100), nullable=True),
        sa.Column('scope', sa.String(50), nullable=True),
        sa.Column('granted_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('granted_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('vouchers',
        sa.Column('voucher_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('code', sa.String(50), unique=True, nullable=False),
        sa.Column('discount_type', sa.String(50), nullable=True),
        sa.Column('discount_value', sa.Numeric(10, 2), nullable=False),
        sa.Column('min_order_value', sa.Numeric(10, 2), nullable=True),
        sa.Column('max_discount', sa.Numeric(10, 2), nullable=True),
        sa.Column('max_uses', sa.Integer(), nullable=True),
        sa.Column('current_uses', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(50), nullable=True),
        sa.Column('valid_from', sa.DateTime(timezone=False), nullable=True),
        sa.Column('valid_to', sa.DateTime(timezone=False), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('products',
        sa.Column('product_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('shop_id', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('product_categories.category_id'), nullable=True),
        sa.Column('product_name', sa.String(255), nullable=False),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('price', sa.Numeric(10, 2), nullable=False),
        sa.Column('cost', sa.Numeric(10, 2), nullable=True),
        sa.Column('stock_quantity', sa.Integer(), nullable=True),
        sa.Column('image_urls', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(50), nullable=True),
        sa.Column('rating', sa.Numeric(3, 2), nullable=True),
        sa.Column('total_reviews', sa.Integer(), nullable=True),
        sa.Column('views_count', sa.Integer(), nullable=True),
        sa.Column('sales_count', sa.Integer(), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=False), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=False), nullable=True),
        sa.Column('deleted_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('product_variants',
        sa.Column('variant_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.product_id'), nullable=False),
        sa.Column('variant_name', sa.String(255), nullable=False),
        sa.Column('sku', sa.String(100), nullable=False),
        sa.Column('price', sa.Numeric(10, 2), nullable=False),
        sa.Column('stock', sa.Integer(), nullable=True),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('product_reviews',
        sa.Column('review_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.product_id'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('content', sa.String(255), nullable=True),
        sa.Column('verified', sa.Boolean(), nullable=True),
        sa.Column('helpful', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('stock_reservations',
        sa.Column('reservation_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.order_id'), nullable=False),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.product_id'), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('reserved_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
        sa.Column('expires_at', sa.DateTime(timezone=False), nullable=True),
        sa.Column('status', sa.String(50), nullable=True),
    )
    op.create_table('product_deletion_requests',
        sa.Column('deletion_req_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.product_id'), nullable=False),
        sa.Column('shop_id', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column('requested_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('reason', sa.String(255), nullable=True),
        sa.Column('status', sa.String(50), nullable=True),
        sa.Column('reviewed_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=False), nullable=True),
        sa.Column('review_reason', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('product_deletion_audit_log',
        sa.Column('audit_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('product_name', sa.String(255), nullable=True),
        sa.Column('shop_id', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column('deleted_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('deletion_type', sa.String(50), nullable=True),
        sa.Column('reason', sa.String(255), nullable=True),
        sa.Column('request_id', sa.Integer(), sa.ForeignKey('product_deletion_requests.deletion_req_id'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('shipper_registrations',
        sa.Column('reg_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.user_id'), unique=True, nullable=False),
        sa.Column('vehicle_type', sa.String(50), nullable=True),
        sa.Column('license_plate', sa.String(20), nullable=True),
        sa.Column('license_url', sa.String(500), nullable=True),
        sa.Column('registration_url', sa.String(500), nullable=True),
        sa.Column('id_card_url', sa.String(500), nullable=True),
        sa.Column('status', sa.String(50), nullable=True),
        sa.Column('rejection_reason', sa.String(500), nullable=True),
        sa.Column('reviewed_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=False), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('shippers',
        sa.Column('shipper_id', sa.Integer(), sa.ForeignKey('users.user_id'), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('vehicle_type', sa.String(50), nullable=True),
        sa.Column('license_plate', sa.String(20), nullable=True),
        sa.Column('current_location', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(50), nullable=True),
        sa.Column('rating', sa.String(5), nullable=True),
        sa.Column('total_deliveries', sa.Integer(), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=False), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('carts',
        sa.Column('cart_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.product_id'), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
        sa.UniqueConstraint('user_id', 'product_id', name='unique_user_product'),
    )
    op.create_table('orders',
        sa.Column('order_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('order_number', sa.String(50), unique=True, nullable=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('shop_id', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column('shipper_id', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column('total_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('discount_amount', sa.Numeric(10, 2), nullable=True),
        sa.Column('final_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('shipping_fee', sa.Numeric(10, 2), nullable=True),
        sa.Column('payment_method', sa.String(50), nullable=True),
        sa.Column('payment_status', sa.String(50), nullable=True),
        sa.Column('order_status', sa.String(50), nullable=True),
        sa.Column('shipping_address', sa.String(255), nullable=True),
        sa.Column('recipient_name', sa.String(255), nullable=True),
        sa.Column('recipient_phone', sa.String(20), nullable=True),
        sa.Column('notes', sa.String(255), nullable=True),
        sa.Column('voucher_id', sa.Integer(), sa.ForeignKey('vouchers.voucher_id'), nullable=True),
        sa.Column('voucher_code', sa.String(50), nullable=True),
        sa.Column('confirmed_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column('confirmed_at', sa.DateTime(timezone=False), nullable=True),
        sa.Column('prepared_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column('prepared_at', sa.DateTime(timezone=False), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('order_items',
        sa.Column('order_item_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.order_id'), nullable=False),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.product_id'), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('price_at_order', sa.Numeric(10, 2), nullable=False),
        sa.Column('product_name', sa.String(255), nullable=True),
        sa.Column('product_image', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('payments',
        sa.Column('payment_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.order_id'), unique=True, nullable=False),
        sa.Column('trans_id', sa.String(255), nullable=True),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('method', sa.String(50), nullable=True),
        sa.Column('status', sa.String(50), nullable=True),
        sa.Column('momo_request_id', sa.String(255), nullable=True),
        sa.Column('momo_response', sa.JSON(), nullable=True),
        sa.Column('vnpay_txn_ref', sa.String(100), nullable=True),
        sa.Column('vnpay_response', sa.JSON(), nullable=True),
        sa.Column('cod_collected_at', sa.DateTime(timezone=False), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('shipments',
        sa.Column('shipment_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.order_id'), nullable=False),
        sa.Column('shipper_id', sa.Integer(), sa.ForeignKey('shippers.shipper_id'), nullable=True),
        sa.Column('pickup_location', sa.String(500), nullable=True),
        sa.Column('delivery_location', sa.String(500), nullable=True),
        sa.Column('status', sa.String(50), nullable=True),
        sa.Column('pickup_time', sa.DateTime(timezone=False), nullable=True),
        sa.Column('delivery_time', sa.DateTime(timezone=False), nullable=True),
        sa.Column('current_location', sa.JSON(), nullable=True),
        sa.Column('route', sa.JSON(), nullable=True),
        sa.Column('failure_reason', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('disputes',
        sa.Column('dispute_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.order_id'), nullable=False),
        sa.Column('initiated_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('initiated_party', sa.String(50), nullable=True),
        sa.Column('reason', sa.String(255), nullable=True),
        sa.Column('evidence_urls', sa.String(255), nullable=True),
        sa.Column('status', sa.String(50), nullable=True),
        sa.Column('resolved_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column('resolution_details', sa.String(255), nullable=True),
        sa.Column('refund_amount', sa.Numeric(10, 2), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
        sa.Column('resolved_at', sa.DateTime(timezone=False), nullable=True),
    )
    op.create_table('notifications',
        sa.Column('notification_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('message', sa.String(255), nullable=False),
        sa.Column('type', sa.String(50), nullable=True),
        sa.Column('related_entity_type', sa.String(50), nullable=True),
        sa.Column('related_entity_id', sa.Integer(), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=True),
        sa.Column('read_at', sa.DateTime(timezone=False), nullable=True),
        sa.Column('action_url', sa.String(500), nullable=True),
        sa.Column('data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('notification_preferences',
        sa.Column('pref_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.user_id'), unique=True, nullable=False),
        sa.Column('email_notifications', sa.Boolean(), nullable=True),
        sa.Column('sms_notifications', sa.Boolean(), nullable=True),
        sa.Column('push_notifications', sa.Boolean(), nullable=True),
        sa.Column('notification_types', sa.JSON(), nullable=True),
        sa.Column('quiet_hours_start', sa.Text(), nullable=True),
        sa.Column('quiet_hours_end', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('employee_activity_logs',
        sa.Column('log_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=True),
        sa.Column('employee_type', sa.String(50), nullable=True),
        sa.Column('action', sa.String(100), nullable=True),
        sa.Column('entity_type', sa.String(50), nullable=True),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('admin_logs',
        sa.Column('log_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('admin_id', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('action', sa.String(100), nullable=True),
        sa.Column('target_type', sa.String(50), nullable=True),
        sa.Column('target_id', sa.Integer(), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )
    op.create_table('system_logs',
        sa.Column('log_id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('level', sa.String(50), nullable=True),
        sa.Column('message', sa.String(255), nullable=True),
        sa.Column('context', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=False), nullable=True, server_default=sa.text('now()')),
    )

    # Indexes
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_status', 'users', ['status'])
    op.create_index('idx_current_role', 'user_roles', ['user_id', 'current_role'])
    op.create_index('ix_shops_verification_status', 'shops', ['verification_status'])
    op.create_index('ix_shop_registrations_status', 'shop_registrations', ['status'])
    op.create_index('idx_shop_employee', 'shop_employees', ['shop_id'])
    op.create_index('ix_shop_employees_status', 'shop_employees', ['status'])
    op.create_index('idx_emp_permission', 'employee_role_permissions', ['employee_id'])
    op.create_index('ix_system_employees_status', 'system_employees', ['status'])
    op.create_index('idx_voucher_code', 'vouchers', ['code'])
    op.create_index('idx_voucher_status', 'vouchers', ['status'])
    op.create_index('ix_vouchers_status', 'vouchers', ['status'])
    op.create_index('idx_product_shop', 'products', ['shop_id'])
    op.create_index('idx_product_status', 'products', ['status'])
    op.create_index('ix_products_status', 'products', ['status'])
    op.create_index('idx_product_category', 'products', ['category_id'])
    op.create_index('idx_product_created', 'products', ['created_at'])
    op.create_index('ix_product_variants_sku', 'product_variants', ['sku'])
    op.create_index('idx_variant_product', 'product_variants', ['product_id'])
    op.create_index('idx_review_user', 'product_reviews', ['user_id'])
    op.create_index('idx_review_product', 'product_reviews', ['product_id'])
    op.create_index('ix_stock_reservations_status', 'stock_reservations', ['status'])
    op.create_index('ix_product_deletion_requests_status', 'product_deletion_requests', ['status'])
    op.create_index('idx_audit_shop', 'product_deletion_audit_log', ['shop_id'])
    op.create_index('idx_audit_deleted_at', 'product_deletion_audit_log', ['deleted_at'])
    op.create_index('ix_shipper_registrations_status', 'shipper_registrations', ['status'])
    op.create_index('ix_shippers_status', 'shippers', ['status'])
    op.create_index('idx_cart_user', 'carts', ['user_id'])
    op.create_index('idx_order_status', 'orders', ['order_status'])
    op.create_index('idx_order_created', 'orders', ['created_at'])
    op.create_index('idx_order_user', 'orders', ['user_id'])
    op.create_index('ix_orders_order_status', 'orders', ['order_status'])
    op.create_index('ix_orders_order_number', 'orders', ['order_number'], unique=True)
    op.create_index('idx_order_shop', 'orders', ['shop_id'])
    op.create_index('idx_order_item_order', 'order_items', ['order_id'])
    op.create_index('ix_payments_status', 'payments', ['status'])
    op.create_index('idx_payment_status', 'payments', ['status'])
    op.create_index('ix_shipments_status', 'shipments', ['status'])
    op.create_index('idx_shipment_shipper', 'shipments', ['shipper_id'])
    op.create_index('idx_shipment_status', 'shipments', ['status'])
    op.create_index('idx_dispute_status', 'disputes', ['status'])
    op.create_index('ix_disputes_status', 'disputes', ['status'])
    op.create_index('idx_notif_user_created', 'notifications', ['user_id', 'created_at'])
    op.create_index('idx_notif_user_read', 'notifications', ['user_id', 'is_read'])
    op.create_index('idx_emp_log_created', 'employee_activity_logs', ['created_at'])
    op.create_index('idx_emp_log_employee', 'employee_activity_logs', ['employee_id'])
    op.create_index('idx_admin_log_created', 'admin_logs', ['created_at'])
    op.create_index('idx_admin_log_admin', 'admin_logs', ['admin_id'])
    op.create_index('idx_sys_log_created', 'system_logs', ['created_at'])
    op.create_index('ix_system_logs_level', 'system_logs', ['level'])
    op.create_index('idx_sys_log_level', 'system_logs', ['level'])


def downgrade() -> None:
    op.drop_table('system_logs')
    op.drop_table('admin_logs')
    op.drop_table('employee_activity_logs')
    op.drop_table('notification_preferences')
    op.drop_table('notifications')
    op.drop_table('disputes')
    op.drop_table('shipments')
    op.drop_table('payments')
    op.drop_table('order_items')
    op.drop_table('orders')
    op.drop_table('carts')
    op.drop_table('shippers')
    op.drop_table('shipper_registrations')
    op.drop_table('product_deletion_audit_log')
    op.drop_table('product_deletion_requests')
    op.drop_table('stock_reservations')
    op.drop_table('product_reviews')
    op.drop_table('product_variants')
    op.drop_table('products')
    op.drop_table('vouchers')
    op.drop_table('system_employee_permissions')
    op.drop_table('system_employees')
    op.drop_table('employee_role_permissions')
    op.drop_table('shop_employees')
    op.drop_table('shop_registrations')
    op.drop_table('shops')
    op.drop_table('product_categories')
    op.drop_table('role_permissions')
    op.drop_table('user_roles')
    op.drop_table('users')
    op.drop_table('permissions')
    op.drop_table('roles')
