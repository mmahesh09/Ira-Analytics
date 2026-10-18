"""Database tables. Migrations live in backend/alembic."""

from datetime import datetime

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

JSONType = JSON().with_variant(JSONB(), "postgresql")


class Base(DeclarativeBase):
    pass


def _now() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# Better Auth owns these two tables (created by `npx @better-auth/cli migrate` in frontend/).
# Mapped read-only here so FastAPI can resolve the session cookie; alembic/env.py skips them.
BETTER_AUTH_TABLES = {"user", "session", "account", "verification"}


class User(Base):
    __tablename__ = "user"
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    email: Mapped[str] = mapped_column(Text)


class AuthSession(Base):
    __tablename__ = "session"
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    token: Mapped[str] = mapped_column(Text)
    user_id: Mapped[str] = mapped_column("userId", Text, ForeignKey("user.id"))
    expires_at: Mapped[datetime] = mapped_column("expiresAt", DateTime(timezone=True))


class Site(Base):
    __tablename__ = "sites"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[str] = mapped_column(Text, ForeignKey("user.id", ondelete="CASCADE"), index=True)
    domain: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(120))
    tracking_key: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    # scheduled audits: off | daily | weekly
    audit_cadence: Mapped[str] = mapped_column(String(8), default="weekly")
    next_audit_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # secret in the deploy webhook URL (Change Detective: audit right after a release)
    deploy_token: Mapped[str | None] = mapped_column(String(48), unique=True)
    created_at: Mapped[datetime] = _now()


class Job(Base):
    """Background work for app/worker.py: audits, link crawls. Claimed with FOR UPDATE SKIP LOCKED."""

    __tablename__ = "jobs"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    kind: Mapped[str] = mapped_column(String(32))  # audit | links
    payload: Mapped[dict] = mapped_column(JSONType, default=dict)
    status: Mapped[str] = mapped_column(String(12), default="queued")  # queued | running | done | failed
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    run_at: Mapped[datetime] = _now()
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _now()

    __table_args__ = (Index("ix_jobs_status_run_at", "status", "run_at"),)


class Issue(Base):
    """One problem tracked across audits by fingerprint (module:check), for health history and change detection."""

    __tablename__ = "issues"
    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), index=True)
    fingerprint: Mapped[str] = mapped_column(String(160))
    module: Mapped[str] = mapped_column(String(16))
    check_id: Mapped[str] = mapped_column(String(120))
    title: Mapped[str] = mapped_column(String(300))
    severity: Mapped[str] = mapped_column(String(8))  # fail | warn
    status: Mapped[str] = mapped_column(String(10), default="open")  # open | resolved
    first_seen_at: Mapped[datetime] = _now()
    last_seen_at: Mapped[datetime] = _now()
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_audit_id: Mapped[int | None] = mapped_column(ForeignKey("audits.id", ondelete="SET NULL"))

    __table_args__ = (Index("uq_issues_site_fp", "site_id", "fingerprint", unique=True),)


class LinkCheck(Base):
    """Latest status of every link found on a site (Broken Link Monitor)."""

    __tablename__ = "link_checks"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(String(2048))
    source_url: Mapped[str] = mapped_column(String(2048))
    internal: Mapped[bool] = mapped_column(Boolean, default=True)
    ok: Mapped[bool] = mapped_column(Boolean, default=True)
    status_code: Mapped[int | None] = mapped_column(Integer)
    error: Mapped[str | None] = mapped_column(String(300))
    first_broken_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_checked_at: Mapped[datetime] = _now()

    __table_args__ = (Index("uq_link_checks_site_url", "site_id", "url", unique=True),)


class Event(Base):
    """One pageview or custom event from the tracking script. No IPs or cookies are stored."""

    __tablename__ = "events"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"))
    ts: Mapped[datetime] = _now()
    name: Mapped[str] = mapped_column(String(64), default="pageview")
    path: Mapped[str] = mapped_column(String(1024))
    referrer_host: Mapped[str | None] = mapped_column(String(255))
    utm_source: Mapped[str | None] = mapped_column(String(128))
    utm_medium: Mapped[str | None] = mapped_column(String(128))
    utm_campaign: Mapped[str | None] = mapped_column(String(128))
    country: Mapped[str | None] = mapped_column(String(2))
    device: Mapped[str | None] = mapped_column(String(16))
    browser: Mapped[str | None] = mapped_column(String(64))
    os: Mapped[str | None] = mapped_column(String(64))
    visitor_id: Mapped[str] = mapped_column(String(32))
    session_id: Mapped[str] = mapped_column(String(32))
    duration_ms: Mapped[int | None] = mapped_column(Integer)

    __table_args__ = (Index("ix_events_site_ts", "site_id", "ts"),)


class Competitor(Base):
    __tablename__ = "competitors"
    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), index=True)
    domain: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = _now()


class Audit(Base):
    __tablename__ = "audits"
    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), index=True)
    competitor_id: Mapped[int | None] = mapped_column(ForeignKey("competitors.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(String(2048))
    overall_score: Mapped[int] = mapped_column(Integer)
    seo: Mapped[int | None] = mapped_column(Integer)
    aeo: Mapped[int | None] = mapped_column(Integer)
    geo: Mapped[int | None] = mapped_column(Integer)
    speed: Mapped[int | None] = mapped_column(Integer)
    report: Mapped[dict] = mapped_column(JSONType)
    trigger: Mapped[str] = mapped_column(String(16), default="manual")
    created_at: Mapped[datetime] = _now()


class AiPrompt(Base):
    __tablename__ = "ai_prompts"
    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), index=True)
    prompt: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = _now()


class AiRewrite(Base):
    """One AI Content Optimization request; counted per calendar month against the plan's ai_rewrites."""
    __tablename__ = "ai_rewrites"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[str] = mapped_column(Text, ForeignKey("user.id", ondelete="CASCADE"), index=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), index=True)
    field: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = _now()


class AiRun(Base):
    __tablename__ = "ai_runs"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    prompt_id: Mapped[int] = mapped_column(ForeignKey("ai_prompts.id", ondelete="CASCADE"), index=True)
    model: Mapped[str] = mapped_column(String(128))
    mentioned: Mapped[bool] = mapped_column(Boolean, default=False)
    cited: Mapped[bool] = mapped_column(Boolean, default=False)
    # competitor domains named in the same answer, for share of voice
    competitors_mentioned: Mapped[list] = mapped_column(JSONType, default=list)
    answer: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = _now()


class Integration(Base):
    __tablename__ = "integrations"
    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(8))  # gsc | ga4
    property_id: Mapped[str | None] = mapped_column(String(255))
    refresh_token_encrypted: Mapped[str] = mapped_column(Text)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = _now()


class Subscription(Base):
    """One Razorpay subscription. Webhooks are the source of truth for `status` and the billing period."""

    __tablename__ = "subscriptions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(Text, ForeignKey("user.id", ondelete="CASCADE"), index=True)
    plan_id: Mapped[str] = mapped_column(String(16))  # pro | business
    currency: Mapped[str] = mapped_column(String(3))  # inr | usd
    razorpay_subscription_id: Mapped[str] = mapped_column(String(64), unique=True)
    razorpay_plan_id: Mapped[str] = mapped_column(String(64))
    # created | authenticated | active | pending | halted | cancelled | completed | expired | paused
    status: Mapped[str] = mapped_column(String(16), default="created")
    current_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_at_cycle_end: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = _now()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class BillingEvent(Base):
    """Every Razorpay webhook we accepted, stored once (event id is unique) so retries are no-ops."""

    __tablename__ = "billing_events"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    type: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict] = mapped_column(JSONType)
    received_at: Mapped[datetime] = _now()


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(32))
    message: Mapped[str] = mapped_column(String(500))
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = _now()
