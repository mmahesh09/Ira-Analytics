"""Feedback: remember which rows were copied to the Google Sheet.

Additive only: one nullable column.

Revision ID: 0005_feedback_sheet_sync
Revises: 0004_feedback
Create Date: 2026-10-20
"""

import sqlalchemy as sa

from alembic import op

revision = "0005_feedback_sheet_sync"
down_revision = "0004_feedback"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('feedback', sa.Column('sheet_synced_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('feedback', 'sheet_synced_at')
