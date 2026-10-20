"""API rate limits: fixed-window request counters per user / hashed IP.

Additive only: one new table.

Revision ID: 0003_api_rate
Revises: 0002_credits_billing
Create Date: 2026-10-20
"""

import sqlalchemy as sa

from alembic import op

revision = "0003_api_rate"
down_revision = "0002_credits_billing"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('api_rate',
    sa.Column('key', sa.String(length=96), nullable=False),
    sa.Column('window_start', sa.DateTime(timezone=True), nullable=False),
    sa.Column('count', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('key', 'window_start')
    )


def downgrade() -> None:
    op.drop_table('api_rate')
