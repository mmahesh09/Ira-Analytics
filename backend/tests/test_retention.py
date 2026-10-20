"""Daily clean-up removes only aged operational rows; full audits, credits and payments stay."""

from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from app.retention import prune_old_data
from app.schema import Alert, Audit, BillingEvent, Job, Payment, PreviewUsage
from tests.conftest import make_site, make_user

pytestmark = pytest.mark.asyncio
NOW = datetime.now(timezone.utc)
OLD = NOW - timedelta(days=400)


async def test_prunes_only_aged_operational_rows(db):
    user = await make_user(db)
    site = await make_site(db, user)
    db.add_all([
        Job(kind="check", payload={"site_id": site}, status="done", finished_at=OLD),
        Job(kind="check", payload={"site_id": site}, status="done", finished_at=NOW),
        Job(kind="audit", payload={"site_id": site}, status="queued"),
        PreviewUsage(ip_hash="a" * 64, day=date.today() - timedelta(days=30), count=2),
        PreviewUsage(ip_hash="b" * 64, day=date.today(), count=1),
        BillingEvent(id="evt_old", type="subscription.charged", payload={}, received_at=OLD),
        BillingEvent(id="evt_new", type="subscription.charged", payload={}),
        Alert(site_id=site, kind="regression", message="old read", read=True, created_at=OLD),
        Alert(site_id=site, kind="regression", message="old unread", read=False, created_at=OLD),
        Audit(site_id=site, url="https://example.com/", overall_score=60, report={}, kind="check", created_at=OLD),
        Audit(site_id=site, url="https://example.com/", overall_score=60, report={}, kind="full", created_at=OLD),
        Payment(id="pay_old", user_id=user, kind="subscription", amount=149900, currency="inr", status="captured", paid_at=OLD),
    ])
    await db.commit()

    removed = await prune_old_data(db, NOW)

    assert removed == {"jobs": 1, "preview_usage": 1, "billing_events": 1, "read_alerts": 1, "light_checks": 1}
    assert await db.scalar(select(func.count()).select_from(Job)) == 2
    assert await db.scalar(select(func.count()).select_from(Alert)) == 1  # unread alerts are kept
    assert [k for k in await db.scalars(select(Audit.kind))] == ["full"]  # full audits are never pruned
    assert await db.scalar(select(func.count()).select_from(Payment)) == 1
