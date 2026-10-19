"""Plans, prices, credit costs and entitlements: the single server-side source of truth.

frontend/src/lib/plans.ts mirrors the display numbers; tests/test_billing.py fails if the two drift.

Two kinds of work, metered differently:
- full audit: every module plus a link crawl, stored as a report. Costs credits (CREDIT_COST).
- light check: fetch-only SEO/AEO/GEO rule checks (no PageSpeed, browser, DataForSEO, LLM or crawl).
  Free of credits but capped per day (daily_checks), so scheduled monitoring never spends full audits.
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .schema import Subscription

PLAN_IDS = ("free", "pro", "business", "scale")
PAID_PLANS = ("pro", "business", "scale")
CURRENCIES = ("inr", "usd")
# smallest currency unit (paise / cents) charged per month. INR is a regional price, never an FX conversion;
# each (plan, currency) pair must map to its own Razorpay plan id (settings.razorpay_plans).
PRICES = {
    ("pro", "inr"): 149900, ("pro", "usd"): 1900,
    ("business", "inr"): 599900, ("business", "usd"): 7900,
    ("scale", "inr"): 1199900, ("scale", "usd"): 14900,
}
# statuses that keep paid features on; "pending" = Razorpay is retrying a failed charge (grace period)
ENTITLED_STATUSES = ("authenticated", "active", "pending")

CREDIT_COST = {"audit": 1, "deep_audit": 3}
DEEP_CRAWL_PAGES = 500
LINKS_PER_PAGE = 30  # link checks allowed per crawled page


@dataclass(frozen=True)
class Pack:
    credits: int
    prices: dict  # currency -> smallest unit
    valid_days: int = 365


# one-time credit packs (paid plans only); used after monthly credits, refundable only while unused
PACKS = {
    "pack_5": Pack(credits=5, prices={"inr": 119900, "usd": 1500}),
    "pack_20": Pack(credits=20, prices={"inr": 399900, "usd": 4900}),
}


@dataclass(frozen=True)
class Entitlements:
    sites: int
    monthly_credits: int  # full-audit credits granted each month / billing period; no rollover
    crawl_pages: int  # pages the link crawl of a standard full audit follows
    deep_audit: bool  # may spend CREDIT_COST["deep_audit"] on a DEEP_CRAWL_PAGES crawl
    check_cadence: str  # most frequent scheduled light check: weekly | daily
    daily_checks: int  # light checks per UTC day across all sites (schedule + manual + "Mark fixed")
    credit_packs: bool
    ai_rewrites: int  # AI Content Optimization per calendar month (only when an LLM key is configured; not advertised)

    @property
    def audit_cadence(self) -> str:  # older name, still read by the scheduler
        return self.check_cadence


ENTITLEMENTS = {
    "free": Entitlements(sites=1, monthly_credits=1, crawl_pages=10, deep_audit=False, check_cadence="weekly", daily_checks=3, credit_packs=False, ai_rewrites=5),
    "pro": Entitlements(sites=3, monthly_credits=3, crawl_pages=50, deep_audit=False, check_cadence="daily", daily_checks=10, credit_packs=True, ai_rewrites=100),
    "business": Entitlements(sites=10, monthly_credits=7, crawl_pages=100, deep_audit=True, check_cadence="daily", daily_checks=40, credit_packs=True, ai_rewrites=1000),
    "scale": Entitlements(sites=25, monthly_credits=11, crawl_pages=100, deep_audit=True, check_cadence="daily", daily_checks=100, credit_packs=True, ai_rewrites=1000),
}


async def current_subscription(db: AsyncSession, user_id: str) -> Subscription | None:
    """The user's most recent subscription, entitled or not."""
    return await db.scalar(select(Subscription).where(Subscription.user_id == user_id).order_by(Subscription.created_at.desc()).limit(1))


async def entitled_subscription(db: AsyncSession, user_id: str) -> Subscription | None:
    return await db.scalar(
        select(Subscription)
        .where(Subscription.user_id == user_id, Subscription.status.in_(ENTITLED_STATUSES))
        .order_by(Subscription.created_at.desc())
        .limit(1)
    )


async def effective_plan(db: AsyncSession, user_id: str) -> str:
    sub = await entitled_subscription(db, user_id)
    return sub.plan_id if sub and sub.plan_id in ENTITLEMENTS else "free"
