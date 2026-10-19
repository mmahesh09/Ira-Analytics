"""Full-audit credit ledger on Postgres.

Credits live in grants (a month's allowance, a pack, an adjustment). A full audit first *reserves* credits,
then *captures* them once its report is stored, or *releases* them back when no report comes out.

Concurrency: every balance change for a user runs under pg_advisory_xact_lock(user) and SELECT ... FOR UPDATE
on the grant rows, so parallel requests serialise and the balance can't go negative (a CHECK constraint
backs this up). Idempotency: grants, reservations and ledger rows each carry a unique key, so a retried
request, job or webhook finds the existing row instead of charging or granting twice.

These functions never commit: the caller commits, so a reservation and the job that spends it land together.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import case, func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .plans import CREDIT_COST, ENTITLEMENTS, entitled_subscription
from .schema import CreditGrant, CreditLedger, CreditReservation, Job

REFUND_GRACE = timedelta(days=30)  # a refund whose grant already expired comes back as a 30-day adjustment
STALE_AFTER = timedelta(hours=6)


class InsufficientCredits(Exception):
    def __init__(self, needed: int, available: int):
        super().__init__(f"This needs {needed} credit{'s' if needed != 1 else ''}; you have {available}.")
        self.needed, self.available = needed, available


@dataclass
class Balance:
    monthly: int
    pack: int
    adjustment: int
    monthly_expires_at: datetime | None

    @property
    def total(self) -> int:
        return self.monthly + self.pack + self.adjustment


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def lock_user(db: AsyncSession, user_id: str, scope: str = "credits") -> None:
    """Transaction-scoped lock: concurrent requests for the same user and scope run one after another."""
    await db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:k))"), {"k": f"{scope}:{user_id}"})


async def _ledger(db: AsyncSession, user_id: str, kind: str, delta: int, key: str, grant_id: int | None = None,
                  reservation_id: str | None = None, note: str | None = None) -> None:
    await db.execute(
        pg_insert(CreditLedger)
        .values(user_id=user_id, kind=kind, delta=delta, key=key, grant_id=grant_id, reservation_id=reservation_id, note=note)
        .on_conflict_do_nothing(index_elements=["key"])
    )


async def grant(db: AsyncSession, user_id: str, source: str, amount: int, key: str, *, expires_at: datetime | None,
                period_start: datetime | None = None, subscription_id: int | None = None, payment_id: str | None = None) -> bool:
    """Adds a grant once per key. Returns False when the key was already granted."""
    grant_id = await db.scalar(
        pg_insert(CreditGrant)
        .values(user_id=user_id, source=source, amount=amount, remaining=amount, key=key, expires_at=expires_at,
                period_start=period_start, subscription_id=subscription_id, payment_id=payment_id)
        .on_conflict_do_nothing(index_elements=["key"])
        .returning(CreditGrant.id)
    )
    if grant_id is None:
        return False
    await _ledger(db, user_id, "grant", amount, f"grant:{key}", grant_id=grant_id, note=source)
    return True


def _month_bounds(now: datetime) -> tuple[datetime, datetime]:
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end = (start + timedelta(days=32)).replace(day=1)
    return start, end


async def ensure_monthly_grant(db: AsyncSession, user_id: str, now: datetime | None = None) -> None:
    """This period's allowance: per billing period for an active paid plan, per UTC calendar month otherwise.

    A subscription that is only retrying a failed charge ("pending") keeps the plan but gets no new grant.
    """
    now = now or _now()
    sub = await entitled_subscription(db, user_id)
    if sub and sub.status == "active" and sub.current_start and sub.current_end and sub.current_start <= now < sub.current_end:
        credits = ENTITLEMENTS[sub.plan_id].monthly_credits
        key = f"monthly:sub:{sub.razorpay_subscription_id}:{int(sub.current_start.timestamp())}"
        await grant(db, user_id, "monthly", credits, key, expires_at=sub.current_end, period_start=sub.current_start, subscription_id=sub.id)
        return
    if sub:  # paid but not yet active, or in a failed-payment grace period
        return
    start, end = _month_bounds(now)
    await grant(db, user_id, "monthly", ENTITLEMENTS["free"].monthly_credits, f"monthly:free:{user_id}:{start:%Y-%m}", expires_at=end, period_start=start)


def _usable(user_id: str, now: datetime):
    return (CreditGrant.user_id == user_id, CreditGrant.remaining > 0, (CreditGrant.expires_at.is_(None)) | (CreditGrant.expires_at > now))


async def balance(db: AsyncSession, user_id: str, now: datetime | None = None) -> Balance:
    now = now or _now()
    rows = (await db.execute(
        select(CreditGrant.source, func.sum(CreditGrant.remaining), func.min(CreditGrant.expires_at)).where(*_usable(user_id, now)).group_by(CreditGrant.source)
    )).all()
    by_source = {source: (int(total or 0), expires) for source, total, expires in rows}
    return Balance(
        monthly=by_source.get("monthly", (0, None))[0],
        pack=by_source.get("pack", (0, None))[0],
        adjustment=by_source.get("adjustment", (0, None))[0],
        monthly_expires_at=by_source.get("monthly", (0, None))[1],
    )


async def reserve(db: AsyncSession, user_id: str, kind: str, key: str, site_id: int | None = None) -> CreditReservation:
    """Holds CREDIT_COST[kind] credits. The same key returns the same reservation instead of charging again.

    Spends monthly credits first, then adjustments, then packs; within each, the soonest to expire first.
    Raises InsufficientCredits without changing anything.
    """
    cost = CREDIT_COST[kind]
    await lock_user(db, user_id)
    existing = await db.scalar(select(CreditReservation).where(CreditReservation.key == key))
    if existing:
        if existing.user_id != user_id:
            raise ValueError("idempotency key belongs to another user")
        return existing

    now = _now()
    await ensure_monthly_grant(db, user_id, now)
    order = case((CreditGrant.source == "monthly", 0), (CreditGrant.source == "adjustment", 1), else_=2)
    grants = list(await db.scalars(
        select(CreditGrant).where(*_usable(user_id, now)).order_by(order, CreditGrant.expires_at.asc().nulls_last(), CreditGrant.id).with_for_update()
    ))
    available = sum(g.remaining for g in grants)
    if available < cost:
        raise InsufficientCredits(cost, available)

    reservation = CreditReservation(id=uuid.uuid4().hex, user_id=user_id, site_id=site_id, kind=kind, cost=cost, status="held", key=key, allocations=[])
    db.add(reservation)
    await db.flush()
    allocations, needed = [], cost
    for g in grants:
        if needed == 0:
            break
        n = min(g.remaining, needed)
        g.remaining -= n
        needed -= n
        allocations.append({"grant_id": g.id, "n": n})
        await _ledger(db, user_id, "reserve", -n, f"reserve:{reservation.id}:{g.id}", grant_id=g.id, reservation_id=reservation.id, note=kind)
    reservation.allocations = allocations
    await db.flush()
    return reservation


async def capture(db: AsyncSession, reservation_id: str, audit_id: int | None = None) -> bool:
    """Makes a held charge final. Idempotent; returns False if the reservation was already released."""
    r = await db.scalar(select(CreditReservation).where(CreditReservation.id == reservation_id).with_for_update())
    if r is None or r.status == "released":
        return False
    if r.status == "held":
        r.status, r.settled_at, r.audit_id = "captured", _now(), audit_id
        await _ledger(db, r.user_id, "capture", 0, f"capture:{r.id}", reservation_id=r.id)
    return True


async def release(db: AsyncSession, reservation_id: str, reason: str) -> bool:
    """Gives held credits back (the audit produced no report). Idempotent; a captured charge stays captured."""
    r = await db.scalar(select(CreditReservation).where(CreditReservation.id == reservation_id).with_for_update())
    if r is None or r.status != "held":
        return False
    await lock_user(db, r.user_id)
    now = _now()
    for alloc in r.allocations:
        g = await db.scalar(select(CreditGrant).where(CreditGrant.id == alloc["grant_id"]).with_for_update())
        if g is not None and (g.expires_at is None or g.expires_at > now):
            g.remaining += alloc["n"]
            await _ledger(db, r.user_id, "release", alloc["n"], f"release:{r.id}:{g.id}", grant_id=g.id, reservation_id=r.id, note=reason[:200])
        else:  # the original grant ran out meanwhile: refund as a short-lived adjustment instead of losing it
            await grant(db, r.user_id, "adjustment", alloc["n"], f"refund:{r.id}:{alloc['grant_id']}", expires_at=now + REFUND_GRACE)
    r.status, r.settled_at, r.reason = "released", now, reason[:200]
    return True


async def sweep_stale_reservations(db: AsyncSession) -> int:
    """Releases holds whose job vanished (e.g. the job row was deleted or never committed)."""
    cutoff = _now() - STALE_AFTER
    stale = list(await db.scalars(select(CreditReservation.id).where(CreditReservation.status == "held", CreditReservation.created_at < cutoff)))
    released = 0
    for rid in stale:
        alive = await db.scalar(
            select(Job.id).where(Job.status.in_(("queued", "running")), Job.payload["reservation_id"].as_string() == rid).limit(1)
        )
        if not alive and await release(db, rid, "no job ran this audit"):
            released += 1
    return released
