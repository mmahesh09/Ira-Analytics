"""Initial platform schema (every table except Better Auth's, which `npx auth migrate` creates first).

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-19
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('billing_events',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('type', sa.String(length=64), nullable=False),
    sa.Column('payload', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('received_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('jobs',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('kind', sa.String(length=32), nullable=False),
    sa.Column('payload', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('status', sa.String(length=12), nullable=False),
    sa.Column('attempts', sa.Integer(), nullable=False),
    sa.Column('run_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('locked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('error', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_jobs_status_run_at', 'jobs', ['status', 'run_at'], unique=False)
    op.create_table('sites',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('owner_id', sa.Text(), nullable=False),
    sa.Column('domain', sa.String(length=255), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('tracking_key', sa.String(length=32), nullable=False),
    sa.Column('timezone', sa.String(length=64), nullable=False),
    sa.Column('audit_cadence', sa.String(length=8), nullable=False),
    sa.Column('next_audit_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deploy_token', sa.String(length=48), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['owner_id'], ['user.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('deploy_token')
    )
    op.create_index(op.f('ix_sites_owner_id'), 'sites', ['owner_id'], unique=False)
    op.create_index(op.f('ix_sites_tracking_key'), 'sites', ['tracking_key'], unique=True)
    op.create_table('subscriptions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Text(), nullable=False),
    sa.Column('plan_id', sa.String(length=16), nullable=False),
    sa.Column('currency', sa.String(length=3), nullable=False),
    sa.Column('razorpay_subscription_id', sa.String(length=64), nullable=False),
    sa.Column('razorpay_plan_id', sa.String(length=64), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('current_start', sa.DateTime(timezone=True), nullable=True),
    sa.Column('current_end', sa.DateTime(timezone=True), nullable=True),
    sa.Column('cancel_at_cycle_end', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('razorpay_subscription_id')
    )
    op.create_index(op.f('ix_subscriptions_user_id'), 'subscriptions', ['user_id'], unique=False)
    op.create_table('ai_prompts',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('site_id', sa.Integer(), nullable=False),
    sa.Column('prompt', sa.String(length=500), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['site_id'], ['sites.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_prompts_site_id'), 'ai_prompts', ['site_id'], unique=False)
    op.create_table('ai_rewrites',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('user_id', sa.Text(), nullable=False),
    sa.Column('site_id', sa.Integer(), nullable=False),
    sa.Column('field', sa.String(length=16), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['site_id'], ['sites.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_rewrites_site_id'), 'ai_rewrites', ['site_id'], unique=False)
    op.create_index(op.f('ix_ai_rewrites_user_id'), 'ai_rewrites', ['user_id'], unique=False)
    op.create_table('alerts',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('site_id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=32), nullable=False),
    sa.Column('message', sa.String(length=500), nullable=False),
    sa.Column('read', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['site_id'], ['sites.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alerts_site_id'), 'alerts', ['site_id'], unique=False)
    op.create_table('competitors',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('site_id', sa.Integer(), nullable=False),
    sa.Column('domain', sa.String(length=255), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['site_id'], ['sites.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_competitors_site_id'), 'competitors', ['site_id'], unique=False)
    op.create_table('events',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('site_id', sa.Integer(), nullable=False),
    sa.Column('ts', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('name', sa.String(length=64), nullable=False),
    sa.Column('path', sa.String(length=1024), nullable=False),
    sa.Column('referrer_host', sa.String(length=255), nullable=True),
    sa.Column('utm_source', sa.String(length=128), nullable=True),
    sa.Column('utm_medium', sa.String(length=128), nullable=True),
    sa.Column('utm_campaign', sa.String(length=128), nullable=True),
    sa.Column('country', sa.String(length=2), nullable=True),
    sa.Column('device', sa.String(length=16), nullable=True),
    sa.Column('browser', sa.String(length=64), nullable=True),
    sa.Column('os', sa.String(length=64), nullable=True),
    sa.Column('visitor_id', sa.String(length=32), nullable=False),
    sa.Column('session_id', sa.String(length=32), nullable=False),
    sa.Column('duration_ms', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['site_id'], ['sites.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_events_site_ts', 'events', ['site_id', 'ts'], unique=False)
    op.create_table('integrations',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('site_id', sa.Integer(), nullable=False),
    sa.Column('provider', sa.String(length=8), nullable=False),
    sa.Column('property_id', sa.String(length=255), nullable=True),
    sa.Column('refresh_token_encrypted', sa.Text(), nullable=False),
    sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['site_id'], ['sites.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_integrations_site_id'), 'integrations', ['site_id'], unique=False)
    op.create_table('link_checks',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('site_id', sa.Integer(), nullable=False),
    sa.Column('url', sa.String(length=2048), nullable=False),
    sa.Column('source_url', sa.String(length=2048), nullable=False),
    sa.Column('internal', sa.Boolean(), nullable=False),
    sa.Column('ok', sa.Boolean(), nullable=False),
    sa.Column('status_code', sa.Integer(), nullable=True),
    sa.Column('error', sa.String(length=300), nullable=True),
    sa.Column('first_broken_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('last_checked_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['site_id'], ['sites.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_link_checks_site_id'), 'link_checks', ['site_id'], unique=False)
    op.create_index('uq_link_checks_site_url', 'link_checks', ['site_id', 'url'], unique=True)
    op.create_table('ai_runs',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('prompt_id', sa.Integer(), nullable=False),
    sa.Column('model', sa.String(length=128), nullable=False),
    sa.Column('mentioned', sa.Boolean(), nullable=False),
    sa.Column('cited', sa.Boolean(), nullable=False),
    sa.Column('competitors_mentioned', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('answer', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['prompt_id'], ['ai_prompts.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_runs_prompt_id'), 'ai_runs', ['prompt_id'], unique=False)
    op.create_table('audits',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('site_id', sa.Integer(), nullable=True),
    sa.Column('competitor_id', sa.Integer(), nullable=True),
    sa.Column('url', sa.String(length=2048), nullable=False),
    sa.Column('overall_score', sa.Integer(), nullable=False),
    sa.Column('seo', sa.Integer(), nullable=True),
    sa.Column('aeo', sa.Integer(), nullable=True),
    sa.Column('geo', sa.Integer(), nullable=True),
    sa.Column('speed', sa.Integer(), nullable=True),
    sa.Column('report', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('trigger', sa.String(length=16), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['competitor_id'], ['competitors.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['site_id'], ['sites.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audits_competitor_id'), 'audits', ['competitor_id'], unique=False)
    op.create_index(op.f('ix_audits_site_id'), 'audits', ['site_id'], unique=False)
    op.create_table('issues',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('site_id', sa.Integer(), nullable=False),
    sa.Column('fingerprint', sa.String(length=160), nullable=False),
    sa.Column('module', sa.String(length=16), nullable=False),
    sa.Column('check_id', sa.String(length=120), nullable=False),
    sa.Column('title', sa.String(length=300), nullable=False),
    sa.Column('severity', sa.String(length=8), nullable=False),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('first_seen_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('last_seen_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('last_audit_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['last_audit_id'], ['audits.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['site_id'], ['sites.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_issues_site_id'), 'issues', ['site_id'], unique=False)
    op.create_index('uq_issues_site_fp', 'issues', ['site_id', 'fingerprint'], unique=True)


def downgrade() -> None:
    op.drop_index('uq_issues_site_fp', table_name='issues')
    op.drop_index(op.f('ix_issues_site_id'), table_name='issues')
    op.drop_table('issues')
    op.drop_index(op.f('ix_audits_site_id'), table_name='audits')
    op.drop_index(op.f('ix_audits_competitor_id'), table_name='audits')
    op.drop_table('audits')
    op.drop_index(op.f('ix_ai_runs_prompt_id'), table_name='ai_runs')
    op.drop_table('ai_runs')
    op.drop_index('uq_link_checks_site_url', table_name='link_checks')
    op.drop_index(op.f('ix_link_checks_site_id'), table_name='link_checks')
    op.drop_table('link_checks')
    op.drop_index(op.f('ix_integrations_site_id'), table_name='integrations')
    op.drop_table('integrations')
    op.drop_index('ix_events_site_ts', table_name='events')
    op.drop_table('events')
    op.drop_index(op.f('ix_competitors_site_id'), table_name='competitors')
    op.drop_table('competitors')
    op.drop_index(op.f('ix_alerts_site_id'), table_name='alerts')
    op.drop_table('alerts')
    op.drop_index(op.f('ix_ai_rewrites_user_id'), table_name='ai_rewrites')
    op.drop_index(op.f('ix_ai_rewrites_site_id'), table_name='ai_rewrites')
    op.drop_table('ai_rewrites')
    op.drop_index(op.f('ix_ai_prompts_site_id'), table_name='ai_prompts')
    op.drop_table('ai_prompts')
    op.drop_index(op.f('ix_subscriptions_user_id'), table_name='subscriptions')
    op.drop_table('subscriptions')
    op.drop_index(op.f('ix_sites_tracking_key'), table_name='sites')
    op.drop_index(op.f('ix_sites_owner_id'), table_name='sites')
    op.drop_table('sites')
    op.drop_index('ix_jobs_status_run_at', table_name='jobs')
    op.drop_table('jobs')
    op.drop_table('billing_events')
