"""Daily clean-up so the database doesn't grow without bound on a free tier.

Only operational rows age out. Full audits, issues, credits, the credit ledger and payments are never pruned.
Everything that references an audit does so with ON DELETE SET NULL, so pruning old light checks is safe.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from .schema import Alert, Audit, BillingEvent, Job, PreviewUsage

KEEP = {
    "jobs": timedelta(days=30),  # finished or failed queue rows
    "preview_usage": timedelta(days=7),  # hashed-IP counters only matter for their own day
    "billing_events": timedelta(days=180),  # webhook dedupe records; Razorpay stops retrying long before
    "read_alerts": timedelta(days=180),
    "light_checks": timedelta(days=90),  # scheduled check reports; trends use full audits
}


async def prune_old_data(db: AsyncSession, now: datetime | None = None) -> dict[str, int]:
    now = now or datetime.now(timezone.utc)
    statements = {
        "jobs": delete(Job).where(Job.status.in_(("done", "failed")), Job.finished_at < now - KEEP["jobs"]),
        "preview_usage": delete(PreviewUsage).where(PreviewUsage.day < (now - KEEP["preview_usage"]).date()),
        "billing_events": delete(BillingEvent).where(BillingEvent.received_at < now - KEEP["billing_events"]),
        "read_alerts": delete(Alert).where(Alert.read.is_(True), Alert.created_at < now - KEEP["read_alerts"]),
        "light_checks": delete(Audit).where(Audit.kind == "check", Audit.created_at < now - KEEP["light_checks"]),
    }
    removed = {name: (await db.execute(stmt)).rowcount or 0 for name, stmt in statements.items()}
    await db.commit()
    return removed
