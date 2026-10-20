"""Product feedback submissions from the public /feedback form.

Additive only: one new table.

Revision ID: 0004_feedback
Revises: 0003_api_rate
Create Date: 2026-10-20
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0004_feedback"
down_revision = "0003_api_rate"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('feedback',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('submission_id', sa.String(length=36), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=True),
    sa.Column('email', sa.String(length=254), nullable=True),
    sa.Column('role', sa.String(length=32), nullable=False),
    sa.Column('role_other', sa.String(length=120), nullable=True),
    sa.Column('usage_frequency', sa.String(length=32), nullable=False),
    sa.Column('satisfaction_rating', sa.Integer(), nullable=False),
    sa.Column('usability_rating', sa.Integer(), nullable=False),
    sa.Column('recommendation_score', sa.Integer(), nullable=False),
    sa.Column('primary_goal', sa.String(length=32), nullable=False),
    sa.Column('primary_goal_other', sa.String(length=120), nullable=True),
    sa.Column('features_used', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('most_valuable_feature', sa.String(length=32), nullable=True),
    sa.Column('biggest_challenge', sa.String(length=32), nullable=False),
    sa.Column('biggest_challenge_other', sa.String(length=120), nullable=True),
    sa.Column('positive_feedback', sa.Text(), nullable=True),
    sa.Column('improvement_suggestions', sa.Text(), nullable=True),
    sa.Column('requested_feature', sa.Text(), nullable=True),
    sa.Column('additional_comments', sa.Text(), nullable=True),
    sa.Column('contact_permission', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('satisfaction_rating BETWEEN 1 AND 5', name='ck_feedback_satisfaction'),
    sa.CheckConstraint('usability_rating BETWEEN 1 AND 5', name='ck_feedback_usability'),
    sa.CheckConstraint('recommendation_score BETWEEN 0 AND 10', name='ck_feedback_recommendation'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('submission_id')
    )
    op.create_index(op.f('ix_feedback_created_at'), 'feedback', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_feedback_created_at'), table_name='feedback')
    op.drop_table('feedback')
