"""Plan entitlements. Mirrors frontend/src/lib/plans.ts; keep both in sync."""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .schema import Subscription

PAID_PLANS = ("pro", "business")
CURRENCIES = ("inr", "usd")
# smallest currency unit (paise / cents) charged per month
PRICES = {("pro", "inr"): 149900, ("pro", "usd"): 1900, ("business", "inr"): 599900, ("business", "usd"): 7900}
# statuses that keep paid features on; "pending" = Razorpay is retrying a failed charge (grace period)
ENTITLED_STATUSES = ("authenticated", "active", "pending")


@dataclass(frozen=True)
class Entitlements:
    sites: int
    pageviews: int
    audit_cadence: str
    ai_prompts: int
    competitors: int
    retention_months: int
    google_integrations: bool
    crawl_pages: int  # pages the Broken Link Monitor follows per run


ENTITLEMENTS = {
    "free": Entitlements(sites=1, pageviews=10_000, audit_cadence="monthly", ai_prompts=3, competitors=0, retention_months=6, google_integrations=False, crawl_pages=3),
    "pro": Entitlements(sites=5, pageviews=100_000, audit_cadence="weekly", ai_prompts=25, competitors=3, retention_months=24, google_integrations=True, crawl_pages=25),
    "business": Entitlements(sites=25, pageviews=1_000_000, audit_cadence="daily", ai_prompts=200, competitors=10, retention_months=60, google_integrations=True, crawl_pages=100),
}


async def current_subscription(db: AsyncSession, user_id: str) -> Subscription | None:
    """The user's most recent subscription, entitled or not."""
    return await db.scalar(select(Subscription).where(Subscription.user_id == user_id).order_by(Subscription.created_at.desc()).limit(1))


async def effective_plan(db: AsyncSession, user_id: str) -> str:
    sub = await db.scalar(
        select(Subscription)
        .where(Subscription.user_id == user_id, Subscription.status.in_(ENTITLED_STATUSES))
        .order_by(Subscription.created_at.desc())
        .limit(1)
    )
    return sub.plan_id if sub else "free"
