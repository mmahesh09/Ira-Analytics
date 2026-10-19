"""Account deletion (Better Auth's delete-user): removing the user row must take every Rankwise row with it."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select, text

from app import credits
from app.schema import Alert, Audit, CreditGrant, CreditLedger, CreditOrder, CreditReservation, Payment, Site, Subscription
from tests.conftest import make_site, make_user

pytestmark = pytest.mark.asyncio


async def test_deleting_a_user_cascades_to_all_their_data(db):
    user = await make_user(db, "u_leaving")
    keeper = await make_user(db, "u_staying")
    site = await make_site(db, user)
    kept_site = await make_site(db, keeper, "kept.example")
    now = datetime.now(timezone.utc)

    db.add_all([
        Audit(site_id=site, url="https://example.com/", overall_score=70, report={}, kind="full"),
        Alert(site_id=site, kind="regression", message="x"),
        Subscription(user_id=user, plan_id="pro", currency="inr", razorpay_subscription_id="sub_del", razorpay_plan_id="plan_pro", status="cancelled"),
        CreditOrder(id="order_del", user_id=user, pack_id="pack_5", credits=5, amount=119900, currency="inr"),
        Payment(id="pay_del", user_id=user, kind="pack", amount=119900, currency="inr", status="captured"),
    ])
    await db.commit()
    await credits.grant(db, user, "pack", 5, "pack:pay_del", expires_at=now + timedelta(days=365))
    await credits.reserve(db, user, "audit", "job:del", site)
    await credits.reserve(db, keeper, "audit", "job:keep", kept_site)
    await db.commit()

    await db.execute(text('DELETE FROM "user" WHERE id = :id'), {"id": user})
    await db.commit()

    for model in (Subscription, CreditGrant, CreditReservation, CreditLedger, CreditOrder, Payment):
        assert await db.scalar(select(func.count()).select_from(model).where(model.user_id == user)) == 0, model.__name__
    assert await db.scalar(select(func.count()).select_from(Site).where(Site.owner_id == user)) == 0
    assert await db.scalar(select(func.count()).select_from(Audit).where(Audit.site_id == site)) == 0
    assert await db.scalar(select(func.count()).select_from(Alert).where(Alert.site_id == site)) == 0
    # another user's data is untouched
    assert await db.scalar(select(func.count()).select_from(Site).where(Site.owner_id == keeper)) == 1
    assert await db.scalar(select(func.count()).select_from(CreditReservation).where(CreditReservation.user_id == keeper)) == 1
