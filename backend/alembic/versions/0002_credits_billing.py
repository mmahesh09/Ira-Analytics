"""Credits and billing: credit ledger, credit-pack orders, payment history, anonymous preview usage.

Additive only: new tables plus columns with constant server defaults (no table rewrite, existing rows kept;
every existing audit becomes kind='full').

Revision ID: 0002_credits_billing
Revises: 0001_initial
Create Date: 2026-10-19
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0002_credits_billing"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('preview_usage',
    sa.Column('ip_hash', sa.String(length=64), nullable=False),
    sa.Column('day', sa.Date(), nullable=False),
    sa.Column('count', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('ip_hash', 'day')
    )
    op.create_table('credit_orders',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('user_id', sa.Text(), nullable=False),
    sa.Column('pack_id', sa.String(length=16), nullable=False),
    sa.Column('credits', sa.Integer(), nullable=False),
    sa.Column('amount', sa.Integer(), nullable=False),
    sa.Column('currency', sa.String(length=3), nullable=False),
    sa.Column('status', sa.String(length=12), nullable=False),
    sa.Column('payment_id', sa.String(length=64), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_credit_orders_user_id'), 'credit_orders', ['user_id'], unique=False)
    op.create_table('credit_grants',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('user_id', sa.Text(), nullable=False),
    sa.Column('source', sa.String(length=16), nullable=False),
    sa.Column('amount', sa.Integer(), nullable=False),
    sa.Column('remaining', sa.Integer(), nullable=False),
    sa.Column('period_start', sa.DateTime(timezone=True), nullable=True),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('subscription_id', sa.Integer(), nullable=True),
    sa.Column('payment_id', sa.String(length=64), nullable=True),
    sa.Column('key', sa.String(length=160), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('remaining >= 0 AND remaining <= amount', name='ck_credit_grants_remaining'),
    sa.ForeignKeyConstraint(['subscription_id'], ['subscriptions.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('key')
    )
    op.create_index('ix_credit_grants_user_expires', 'credit_grants', ['user_id', 'expires_at'], unique=False)
    op.create_index(op.f('ix_credit_grants_user_id'), 'credit_grants', ['user_id'], unique=False)
    op.create_table('payments',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('user_id', sa.Text(), nullable=False),
    sa.Column('kind', sa.String(length=16), nullable=False),
    sa.Column('subscription_id', sa.Integer(), nullable=True),
    sa.Column('order_id', sa.String(length=64), nullable=True),
    sa.Column('invoice_id', sa.String(length=64), nullable=True),
    sa.Column('amount', sa.Integer(), nullable=False),
    sa.Column('currency', sa.String(length=3), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('description', sa.String(length=200), nullable=True),
    sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['subscription_id'], ['subscriptions.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_payments_user_id'), 'payments', ['user_id'], unique=False)
    op.create_table('credit_reservations',
    sa.Column('id', sa.String(length=32), nullable=False),
    sa.Column('user_id', sa.Text(), nullable=False),
    sa.Column('site_id', sa.Integer(), nullable=True),
    sa.Column('kind', sa.String(length=16), nullable=False),
    sa.Column('cost', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=12), nullable=False),
    sa.Column('allocations', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('key', sa.String(length=160), nullable=False),
    sa.Column('reason', sa.String(length=200), nullable=True),
    sa.Column('audit_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('settled_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['audit_id'], ['audits.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['site_id'], ['sites.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('key')
    )
    op.create_index('ix_credit_reservations_status_created', 'credit_reservations', ['status', 'created_at'], unique=False)
    op.create_index(op.f('ix_credit_reservations_user_id'), 'credit_reservations', ['user_id'], unique=False)
    op.create_table('credit_ledger',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('user_id', sa.Text(), nullable=False),
    sa.Column('grant_id', sa.BigInteger(), nullable=True),
    sa.Column('reservation_id', sa.String(length=32), nullable=True),
    sa.Column('kind', sa.String(length=16), nullable=False),
    sa.Column('delta', sa.Integer(), nullable=False),
    sa.Column('note', sa.String(length=200), nullable=True),
    sa.Column('key', sa.String(length=200), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['grant_id'], ['credit_grants.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['reservation_id'], ['credit_reservations.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('key')
    )
    op.create_index(op.f('ix_credit_ledger_user_id'), 'credit_ledger', ['user_id'], unique=False)
    op.add_column('audits', sa.Column('kind', sa.String(length=8), server_default='full', nullable=False))
    op.add_column('sites', sa.Column('auto_full_audit', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('subscriptions', sa.Column('last_event_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('subscriptions', sa.Column('scheduled_plan_id', sa.String(length=16), nullable=True))


def downgrade() -> None:
    op.drop_column('subscriptions', 'scheduled_plan_id')
    op.drop_column('subscriptions', 'last_event_at')
    op.drop_column('sites', 'auto_full_audit')
    op.drop_column('audits', 'kind')
    op.drop_index(op.f('ix_credit_ledger_user_id'), table_name='credit_ledger')
    op.drop_table('credit_ledger')
    op.drop_index(op.f('ix_credit_reservations_user_id'), table_name='credit_reservations')
    op.drop_index('ix_credit_reservations_status_created', table_name='credit_reservations')
    op.drop_table('credit_reservations')
    op.drop_index(op.f('ix_payments_user_id'), table_name='payments')
    op.drop_table('payments')
    op.drop_index(op.f('ix_credit_grants_user_id'), table_name='credit_grants')
    op.drop_index('ix_credit_grants_user_expires', table_name='credit_grants')
    op.drop_table('credit_grants')
    op.drop_index(op.f('ix_credit_orders_user_id'), table_name='credit_orders')
    op.drop_table('credit_orders')
    op.drop_table('preview_usage')
