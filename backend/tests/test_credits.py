"""Credit ledger: grants, reservations, captures, refunds and concurrency, against real Postgres."""

import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from app import credits
from app.schema import CreditGrant, CreditLedger, CreditReservation, Job, Subscription
from tests.conftest import make_user

pytestmark = pytest.mark.asyncio
NOW = datetime.now(timezone.utc)


async def _adjust(db, user_id: str, amount: int, key: str, expires_at=None):
    await credits.grant(db, user_id, "adjustment", amount, key, expires_at=expires_at or NOW + timedelta(days=30))
    await db.commit()


async def test_free_monthly_grant_is_issued_once(db):
    user = await make_user(db)
    await credits.ensure_monthly_grant(db, user)
    await credits.ensure_monthly_grant(db, user)
    await db.commit()
    grants = list(await db.scalars(select(CreditGrant).where(CreditGrant.user_id == user)))
    assert [(g.source, g.amount) for g in grants] == [("monthly", 1)]
    assert (await credits.balance(db, user)).total == 1


async def test_reserve_capture_is_charged_once(db):
    user = await make_user(db)
    r = await credits.reserve(db, user, "audit", "job:1")
    await db.commit()
    assert r.status == "held" and (await credits.balance(db, user)).total == 0

    assert await credits.capture(db, r.id, audit_id=None)
    assert await credits.capture(db, r.id)  # idempotent
    assert not await credits.release(db, r.id, "too late")  # a captured charge is final
    await db.commit()
    assert (await credits.balance(db, user)).total == 0
    assert await db.scalar(select(func.count()).select_from(CreditLedger).where(CreditLedger.kind == "capture")) == 1


async def test_same_key_never_charges_twice(db):
    user = await make_user(db)
    await _adjust(db, user, 5, "adj:1")
    first = await credits.reserve(db, user, "audit", "manual:abc")
    await db.commit()
    again = await credits.reserve(db, user, "audit", "manual:abc")
    await db.commit()
    assert again.id == first.id
    assert (await credits.balance(db, user)).total == 5  # 1 free + 5 adjustment - 1


async def test_release_refunds_once(db):
    user = await make_user(db)
    r = await credits.reserve(db, user, "audit", "job:2")
    await db.commit()
    assert await credits.release(db, r.id, "site unreachable")
    assert not await credits.release(db, r.id, "again")
    await db.commit()
    assert (await credits.balance(db, user)).total == 1
    assert (await db.get(CreditReservation, r.id)).status == "released"


async def test_insufficient_credits_changes_nothing(db):
    user = await make_user(db)
    with pytest.raises(credits.InsufficientCredits) as exc:
        await credits.reserve(db, user, "deep_audit", "job:3")
    await db.rollback()
    assert exc.value.needed == 3 and exc.value.available == 1
    assert await db.scalar(select(func.count()).select_from(CreditReservation)) == 0


async def test_monthly_then_adjustment_then_pack_soonest_expiry_first(db):
    user = await make_user(db)
    await credits.grant(db, user, "pack", 5, "pack:p1", expires_at=NOW + timedelta(days=300))
    await _adjust(db, user, 1, "adj:soon", expires_at=NOW + timedelta(days=5))
    r = await credits.reserve(db, user, "deep_audit", "job:4")  # 3 credits: 1 monthly, 1 adjustment, 1 pack
    await db.commit()
    sources = {g.id: g.source for g in await db.scalars(select(CreditGrant))}
    assert [sources[a["grant_id"]] for a in r.allocations] == ["monthly", "adjustment", "pack"]
    bal = await credits.balance(db, user)
    assert (bal.monthly, bal.adjustment, bal.pack) == (0, 0, 4)


async def test_expired_grants_are_not_spendable(db):
    user = await make_user(db)
    await credits.ensure_monthly_grant(db, user)
    await credits.grant(db, user, "pack", 5, "pack:old", expires_at=NOW - timedelta(days=1))
    await db.commit()
    assert (await credits.balance(db, user)).pack == 0
    await credits.reserve(db, user, "audit", "job:5")
    await db.commit()
    with pytest.raises(credits.InsufficientCredits):
        await credits.reserve(db, user, "audit", "job:6")


async def test_refund_after_grant_expired_becomes_adjustment(db):
    user = await make_user(db)
    await _adjust(db, user, 1, "adj:short", expires_at=datetime.now(timezone.utc) + timedelta(days=1))
    await credits.ensure_monthly_grant(db, user)
    await db.commit()
    await credits.reserve(db, user, "audit", "job:7")  # takes the monthly credit
    r = await credits.reserve(db, user, "audit", "job:8")  # takes the short adjustment
    await db.commit()
    grant = await db.get(CreditGrant, r.allocations[0]["grant_id"])
    grant.expires_at = NOW - timedelta(minutes=1)
    await db.commit()
    assert await credits.release(db, r.id, "failed")
    await db.commit()
    refunds = list(await db.scalars(select(CreditGrant).where(CreditGrant.key.like("refund:%"))))
    assert len(refunds) == 1 and refunds[0].remaining == 1 and refunds[0].source == "adjustment"


async def test_paid_period_grant_and_no_grant_while_payment_pending(db):
    user = await make_user(db)
    sub = Subscription(user_id=user, plan_id="pro", currency="inr", razorpay_subscription_id="sub_T1", razorpay_plan_id="plan_x",
                       status="active", current_start=NOW - timedelta(days=1), current_end=NOW + timedelta(days=29))
    db.add(sub)
    await db.commit()
    await credits.ensure_monthly_grant(db, user)
    await credits.ensure_monthly_grant(db, user)
    await db.commit()
    assert (await credits.balance(db, user)).monthly == 3  # Pro, once per period, and no free grant on top

    sub.status = "pending"
    sub.current_start, sub.current_end = NOW + timedelta(days=29), NOW + timedelta(days=59)
    await db.commit()
    await credits.ensure_monthly_grant(db, user, now=NOW + timedelta(days=30))
    await db.commit()
    assert await db.scalar(select(func.count()).select_from(CreditGrant)) == 1


async def test_parallel_reserves_never_overspend(session_factory):
    async with session_factory() as db:
        user = await make_user(db)
        await _adjust(db, user, 2, "adj:race")  # 1 free + 2 = 3 credits

    async def attempt(i: int) -> bool:
        async with session_factory() as s:
            try:
                await credits.reserve(s, user, "audit", f"race:{i}")
                await s.commit()
                return True
            except credits.InsufficientCredits:
                await s.rollback()
                return False

    results = await asyncio.gather(*(attempt(i) for i in range(20)))
    assert results.count(True) == 3
    async with session_factory() as db:
        assert (await credits.balance(db, user)).total == 0
        assert await db.scalar(select(func.min(CreditGrant.remaining))) == 0
        assert await db.scalar(select(func.count()).select_from(CreditReservation)) == 3


async def test_parallel_retries_with_one_key_charge_once(session_factory):
    async with session_factory() as db:
        user = await make_user(db)
        await _adjust(db, user, 4, "adj:retry")

    async def attempt() -> str:
        async with session_factory() as s:
            r = await credits.reserve(s, user, "audit", "job:retry")
            await s.commit()
            return r.id

    ids = await asyncio.gather(*(attempt() for _ in range(10)))
    assert len(set(ids)) == 1
    async with session_factory() as db:
        assert (await credits.balance(db, user)).total == 4


async def test_sweep_releases_orphaned_holds_only(db):
    user = await make_user(db)
    await _adjust(db, user, 1, "adj:sweep")
    orphan = await credits.reserve(db, user, "audit", "job:orphan")
    live = await credits.reserve(db, user, "audit", "job:live")
    db.add(Job(kind="audit", payload={"site_id": 1, "reservation_id": live.id}))
    old = datetime.now(timezone.utc) - timedelta(hours=7)
    orphan.created_at = live.created_at = old
    await db.commit()

    assert await credits.sweep_stale_reservations(db) == 1
    await db.commit()
    assert (await db.get(CreditReservation, orphan.id)).status == "released"
    assert (await db.get(CreditReservation, live.id)).status == "held"
