"""Razorpay billing: plan state, subscriptions (subscribe, verify, change plan, cancel), credit packs (one-time
Orders), payment history and the webhook.

Money is never trusted from the client: plan and pack prices come from app/plans.py and map to Razorpay plan ids
in settings.razorpay_plans. Every credit grant is keyed (credits.grant), so checkout verification, webhooks and
webhook retries can all report the same payment without granting twice.
"""

import json
import logging
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .. import credits, payments
from ..auth import current_user
from ..config import settings
from ..db import get_session
from ..jobs import checks_today
from ..plans import ENTITLED_STATUSES, ENTITLEMENTS, PACKS, PAID_PLANS, current_subscription, effective_plan
from ..schema import BillingEvent, CreditOrder, CreditReservation, Payment, Site, Subscription, User

router = APIRouter(tags=["billing"])
log = logging.getLogger("rankwise.billing")

PlanName = Literal["pro", "business", "scale"]
CurrencyName = Literal["inr", "usd"]
PLAN_NAMES = {"free": "Free", "pro": "Pro", "business": "Business", "scale": "Scale"}


class CreditsOut(BaseModel):
    total: int
    monthly: int
    pack: int
    adjustment: int
    monthly_expires_at: datetime | None


class UsageRow(BaseModel):
    site: str | None
    kind: str  # audit | deep_audit
    cost: int
    status: str  # held (running) | captured (charged) | released (refunded)
    created_at: datetime


class BillingOut(BaseModel):
    plan: str
    status: str | None
    currency: str | None
    current_end: datetime | None
    cancel_at_cycle_end: bool
    scheduled_plan: str | None  # a downgrade waiting for the end of the period
    entitlements: dict
    payments_enabled: bool
    usd_enabled: bool
    credits: CreditsOut
    checks_today: int
    usage: list[UsageRow]


class SubscribeIn(BaseModel):
    plan: PlanName
    currency: CurrencyName


class SubscribeOut(BaseModel):
    subscription_id: str
    key_id: str
    plan: str
    currency: str
    prefill: dict[str, str]


class VerifyIn(BaseModel):
    razorpay_payment_id: str
    razorpay_subscription_id: str
    razorpay_signature: str


class ChangePlanIn(BaseModel):
    plan: PlanName


class PackOrderIn(BaseModel):
    currency: CurrencyName = "inr"


class PackOrderOut(BaseModel):
    order_id: str
    key_id: str
    amount: int
    currency: str
    credits: int
    prefill: dict[str, str]


class PackVerifyIn(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class PaymentOut(BaseModel):
    id: str
    kind: str
    description: str | None
    amount: int  # smallest unit (paise / cents)
    currency: str
    status: str
    paid_at: datetime | None


# ---------- helpers ----------

def _plan_for(razorpay_plan_id: str | None) -> str | None:
    """Our plan id for a Razorpay plan id (settings.razorpay_plans maps "pro_inr" -> "plan_xxx")."""
    for key, value in settings.razorpay_plans.items():
        if value == razorpay_plan_id:
            return key.rsplit("_", 1)[0]
    return None


def _apply(sub: Subscription, entity: dict) -> None:
    """Copies Razorpay's view of a subscription onto our row, including a plan change that took effect."""
    sub.status = entity.get("status", sub.status)
    sub.current_start = payments.ts(entity.get("current_start")) or sub.current_start
    sub.current_end = payments.ts(entity.get("current_end")) or sub.current_end
    if entity.get("status") in ("cancelled", "completed", "expired"):
        sub.cancel_at_cycle_end = False
    new_plan = _plan_for(entity.get("plan_id"))
    if new_plan and entity.get("plan_id") != sub.razorpay_plan_id:
        sub.razorpay_plan_id, sub.plan_id = entity["plan_id"], new_plan
        if sub.scheduled_plan_id == new_plan:
            sub.scheduled_plan_id = None


async def _upgrade_top_up(db: AsyncSession, sub: Subscription, old_plan: str, old_start: datetime | None) -> None:
    """An upgrade mid-period adds the difference in monthly credits once. If Razorpay started a new period
    instead, that period's full grant covers it (credits.ensure_monthly_grant)."""
    old, new = ENTITLEMENTS.get(old_plan), ENTITLEMENTS.get(sub.plan_id)
    if not old or not new or new.monthly_credits <= old.monthly_credits or sub.current_start != old_start or not sub.current_end:
        return
    period = int(sub.current_start.timestamp()) if sub.current_start else 0
    await credits.grant(
        db, sub.user_id, "monthly", new.monthly_credits - old.monthly_credits,
        f"upgrade:{sub.razorpay_subscription_id}:{period}:{sub.plan_id}", expires_at=sub.current_end, subscription_id=sub.id,
    )


async def _record_payment(db: AsyncSession, user_id: str, entity: dict, kind: str, description: str,
                          subscription_id: int | None = None, order_id: str | None = None) -> None:
    status = {"captured": "captured", "failed": "failed", "refunded": "refunded"}.get(entity.get("status", ""), entity.get("status") or "unknown")
    values = dict(
        id=entity["id"], user_id=user_id, kind=kind, subscription_id=subscription_id, order_id=order_id or entity.get("order_id"),
        invoice_id=entity.get("invoice_id"), amount=int(entity.get("amount") or 0), currency=(entity.get("currency") or "INR").lower(),
        status=status[:16], description=description[:200], paid_at=payments.ts(entity.get("created_at")),
    )
    await db.execute(pg_insert(Payment).values(**values).on_conflict_do_update(index_elements=["id"], set_={"status": values["status"]}))


async def _grant_pack(db: AsyncSession, order: CreditOrder, payment_id: str) -> bool:
    """Grants a paid pack once per payment (checkout verify and the order.paid webhook both land here)."""
    granted = await credits.grant(
        db, order.user_id, "pack", order.credits, f"pack:{payment_id}",
        expires_at=datetime.now(timezone.utc) + timedelta(days=PACKS[order.pack_id].valid_days), payment_id=payment_id,
    )
    order.status, order.payment_id = "paid", payment_id
    return granted


async def _state(db: AsyncSession, user: User) -> BillingOut:
    sub = await current_subscription(db, user.id)
    # without webhooks (local dev) a fresh checkout would never update: ask Razorpay directly while it's settling
    if sub and sub.status in ("created", "authenticated") and payments.configured():
        try:
            _apply(sub, await payments.fetch_subscription(sub.razorpay_subscription_id))
            await db.commit()
        except payments.PaymentsError as exc:
            log.warning("subscription sync failed: %s", exc)
    entitled = sub is not None and sub.status in ENTITLED_STATUSES
    plan = sub.plan_id if entitled and sub.plan_id in ENTITLEMENTS else "free"
    await credits.ensure_monthly_grant(db, user.id)  # idempotent: shows this period's allowance before first use
    await db.commit()
    balance = await credits.balance(db, user.id)
    usage = (await db.execute(
        select(CreditReservation, Site.name).outerjoin(Site, Site.id == CreditReservation.site_id)
        .where(CreditReservation.user_id == user.id).order_by(CreditReservation.created_at.desc()).limit(20)
    )).all()
    return BillingOut(
        credits=CreditsOut(total=balance.total, monthly=balance.monthly, pack=balance.pack, adjustment=balance.adjustment, monthly_expires_at=balance.monthly_expires_at),
        checks_today=await checks_today(db, user.id),
        usage=[UsageRow(site=name, kind=r.kind, cost=r.cost, status=r.status, created_at=r.created_at) for r, name in usage],
        plan=plan,
        status=sub.status if sub else None,
        currency=sub.currency if sub else None,
        current_end=sub.current_end if entitled else None,
        cancel_at_cycle_end=bool(sub and entitled and sub.cancel_at_cycle_end),
        scheduled_plan=sub.scheduled_plan_id if entitled else None,
        entitlements=asdict(ENTITLEMENTS[plan]),
        payments_enabled=payments.configured() and bool(settings.razorpay_plans),
        usd_enabled=settings.razorpay_usd_enabled,
    )


def _currency_allowed(currency: str) -> None:
    if currency == "usd" and not settings.razorpay_usd_enabled:
        raise HTTPException(422, "USD payments aren't available yet. Choose INR.")


# ---------- plan & subscription ----------

@router.get("/api/billing", response_model=BillingOut)
async def billing(user: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    return await _state(db, user)


@router.post("/api/billing/subscribe", response_model=SubscribeOut)
async def subscribe(body: SubscribeIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    _currency_allowed(body.currency)
    razorpay_plan_id = settings.razorpay_plans.get(f"{body.plan}_{body.currency}")
    if not payments.configured() or not razorpay_plan_id:
        raise HTTPException(503, "Payments aren't set up yet. Please try again later.")

    latest = await current_subscription(db, user.id)
    if latest and latest.status in ENTITLED_STATUSES:
        raise HTTPException(409, f"You're already on {PLAN_NAMES.get(latest.plan_id, latest.plan_id)}. Use Change plan instead.")
    # reuse an unpaid checkout for the same plan instead of piling up subscriptions
    if latest and latest.status == "created" and latest.razorpay_plan_id == razorpay_plan_id:
        sub = latest
    else:
        try:
            entity = await payments.create_subscription(razorpay_plan_id, {"user_id": user.id, "plan": body.plan, "currency": body.currency})
        except payments.PaymentsError as exc:
            raise HTTPException(502, str(exc)) from None
        sub = Subscription(
            user_id=user.id, plan_id=body.plan, currency=body.currency,
            razorpay_subscription_id=entity["id"], razorpay_plan_id=razorpay_plan_id, status=entity.get("status", "created"),
        )
        db.add(sub)
        await db.commit()

    return SubscribeOut(
        subscription_id=sub.razorpay_subscription_id, key_id=settings.razorpay_key_id, plan=sub.plan_id, currency=sub.currency,
        prefill={"name": user.name or "", "email": user.email},
    )


@router.post("/api/billing/verify", response_model=BillingOut)
async def verify(body: VerifyIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    """Checkout success: check the signature, then read the subscription from Razorpay so credits show up
    straight away; the webhook later reports the same period and changes nothing."""
    sub = await db.scalar(select(Subscription).where(Subscription.razorpay_subscription_id == body.razorpay_subscription_id, Subscription.user_id == user.id))
    if not sub:
        raise HTTPException(404, "Subscription not found.")
    if not payments.verify_payment_signature(body.razorpay_payment_id, body.razorpay_subscription_id, body.razorpay_signature):
        log.warning("bad checkout signature for %s", body.razorpay_subscription_id)
        raise HTTPException(400, "We couldn't verify that payment. If you were charged, it will be confirmed automatically within a few minutes.")
    try:
        _apply(sub, await payments.fetch_subscription(sub.razorpay_subscription_id))
    except payments.PaymentsError as exc:
        log.warning("subscription fetch after checkout failed: %s", exc)
        if sub.status == "created":
            sub.status = "authenticated"
    await db.commit()
    return await _state(db, user)  # grants this period's credits once the subscription is active


@router.post("/api/billing/change-plan", response_model=BillingOut)
async def change_plan(body: ChangePlanIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    """Upgrade now (credit difference added at once) or downgrade at the end of the period."""
    sub = await current_subscription(db, user.id)
    if not sub or sub.status != "active":
        raise HTTPException(409, "You need an active paid plan to change plans. Subscribe from the plans below.")
    if body.plan == sub.plan_id:
        raise HTTPException(409, f"You're already on {PLAN_NAMES[body.plan]}.")
    razorpay_plan_id = settings.razorpay_plans.get(f"{body.plan}_{sub.currency}")
    if not payments.configured() or not razorpay_plan_id:
        raise HTTPException(503, "That plan isn't available for your currency yet.")

    upgrade = PAID_PLANS.index(body.plan) > PAID_PLANS.index(sub.plan_id)
    old_plan, old_start = sub.plan_id, sub.current_start
    try:
        entity = await payments.update_subscription(sub.razorpay_subscription_id, razorpay_plan_id, "now" if upgrade else "cycle_end")
    except payments.PaymentsError as exc:
        raise HTTPException(
            409, f"{exc}. Some payment methods (like UPI Autopay) can't switch plans: cancel, then subscribe to {PLAN_NAMES[body.plan]} when this period ends.",
        ) from None
    if upgrade:
        _apply(sub, {**entity, "plan_id": entity.get("plan_id") or razorpay_plan_id})
        await _upgrade_top_up(db, sub, old_plan, old_start)
    else:
        sub.scheduled_plan_id = body.plan
    await db.commit()
    return await _state(db, user)


@router.post("/api/billing/cancel", response_model=BillingOut)
async def cancel(user: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    sub = await current_subscription(db, user.id)
    if not sub or sub.status not in ENTITLED_STATUSES:
        raise HTTPException(409, "You don't have an active paid plan.")
    try:
        entity = await payments.cancel_subscription(sub.razorpay_subscription_id)
    except payments.PaymentsError as exc:
        raise HTTPException(502, str(exc)) from None
    _apply(sub, entity)
    sub.cancel_at_cycle_end = True
    await db.commit()
    return await _state(db, user)


# ---------- credit packs ----------

@router.post("/api/billing/packs/{pack_id}/order", response_model=PackOrderOut)
async def pack_order(pack_id: str, body: PackOrderIn | None = None, user: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    pack = PACKS.get(pack_id)
    if not pack:
        raise HTTPException(404, "Unknown credit pack.")
    currency = body.currency if body else "inr"
    _currency_allowed(currency)
    if not ENTITLEMENTS[await effective_plan(db, user.id)].credit_packs:
        raise HTTPException(403, "Credit packs are available on paid plans.")
    if not payments.configured():
        raise HTTPException(503, "Payments aren't set up yet. Please try again later.")
    amount = pack.prices[currency]  # from the server's price list, never from the request
    try:
        order = await payments.create_order(amount, currency, f"{pack_id}-{user.id}", {"user_id": user.id, "pack": pack_id})
    except payments.PaymentsError as exc:
        raise HTTPException(502, str(exc)) from None
    db.add(CreditOrder(id=order["id"], user_id=user.id, pack_id=pack_id, credits=pack.credits, amount=amount, currency=currency))
    await db.commit()
    return PackOrderOut(order_id=order["id"], key_id=settings.razorpay_key_id, amount=amount, currency=currency, credits=pack.credits,
                        prefill={"name": user.name or "", "email": user.email})


@router.post("/api/billing/packs/verify", response_model=BillingOut)
async def pack_verify(body: PackVerifyIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    order = await db.scalar(select(CreditOrder).where(CreditOrder.id == body.razorpay_order_id, CreditOrder.user_id == user.id).with_for_update())
    if not order:
        raise HTTPException(404, "Order not found.")
    if not payments.verify_order_signature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature):
        log.warning("bad pack signature for %s", body.razorpay_order_id)
        raise HTTPException(400, "We couldn't verify that payment. If you were charged, the credits will be added automatically within a few minutes.")
    await _grant_pack(db, order, body.razorpay_payment_id)
    await _record_payment(db, user.id, {"id": body.razorpay_payment_id, "status": "captured", "amount": order.amount, "currency": order.currency,
                                         "created_at": int(datetime.now(timezone.utc).timestamp())},
                          "pack", f"{order.credits} audit credits", order_id=order.id)
    await db.commit()
    return await _state(db, user)


@router.get("/api/billing/payments", response_model=list[PaymentOut])
async def payment_history(user: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    rows = await db.scalars(select(Payment).where(Payment.user_id == user.id).order_by(Payment.paid_at.desc().nullslast(), Payment.created_at.desc()).limit(50))
    return [PaymentOut(id=p.id, kind=p.kind, description=p.description, amount=p.amount, currency=p.currency, status=p.status, paid_at=p.paid_at) for p in rows]


# ---------- webhook ----------

@router.post("/api/webhooks/razorpay", include_in_schema=False)
async def razorpay_webhook(request: Request, db: AsyncSession = Depends(get_session)):
    raw = await request.body()
    if not payments.verify_webhook_signature(raw, request.headers.get("x-razorpay-signature", "")):
        raise HTTPException(400, "Invalid signature.")
    event_id = request.headers.get("x-razorpay-event-id", "")
    if not event_id:
        raise HTTPException(400, "Missing event id.")
    event = json.loads(raw)
    kind = event.get("event", "")

    # record first: a retried or concurrently duplicated delivery finds the row and stops here
    fresh = await db.scalar(
        pg_insert(BillingEvent).values(id=event_id[:64], type=kind[:64], payload=event).on_conflict_do_nothing(index_elements=["id"]).returning(BillingEvent.id)
    )
    if fresh is None:
        await db.rollback()
        return {"ok": True, "duplicate": True}

    payload = event.get("payload") or {}
    sub_entity = (payload.get("subscription") or {}).get("entity") or {}
    pay_entity = (payload.get("payment") or {}).get("entity") or {}
    order_entity = (payload.get("order") or {}).get("entity") or {}
    created = payments.ts(event.get("created_at"))

    if sub_entity.get("id"):
        sub = await db.scalar(select(Subscription).where(Subscription.razorpay_subscription_id == sub_entity["id"]).with_for_update())
        if sub is None:
            log.warning("webhook for unknown subscription %s", sub_entity["id"])
        elif sub.last_event_at and created and created < sub.last_event_at:
            log.info("ignoring out-of-order %s for %s", kind, sub.razorpay_subscription_id)
        else:
            old_plan, old_start = sub.plan_id, sub.current_start
            _apply(sub, sub_entity)
            sub.last_event_at = created or sub.last_event_at
            await db.flush()
            if sub.plan_id != old_plan:
                await _upgrade_top_up(db, sub, old_plan, old_start)
            if kind in ("subscription.activated", "subscription.charged", "subscription.updated", "subscription.resumed"):
                await credits.ensure_monthly_grant(db, sub.user_id)  # this period's credits, once
            if kind == "subscription.charged" and pay_entity.get("id"):
                await _record_payment(db, sub.user_id, pay_entity, "subscription", f"{PLAN_NAMES.get(sub.plan_id, sub.plan_id)} plan", subscription_id=sub.id)

    if kind == "order.paid" and order_entity.get("id"):
        order = await db.scalar(select(CreditOrder).where(CreditOrder.id == order_entity["id"]).with_for_update())
        if order and pay_entity.get("id"):
            await _grant_pack(db, order, pay_entity["id"])
            await _record_payment(db, order.user_id, pay_entity, "pack", f"{order.credits} audit credits", order_id=order.id)
        elif not order:
            log.warning("order.paid for unknown order %s", order_entity["id"])

    if kind == "refund.processed":
        refund_entity = (payload.get("refund") or {}).get("entity") or {}
        payment_id = pay_entity.get("id") or refund_entity.get("payment_id")
        row = await db.get(Payment, payment_id, with_for_update=True) if payment_id else None
        if row is None:
            log.warning("refund for unknown payment %s", payment_id)
        else:
            # amount_refunded is the running total across partial refunds; a bare refund entity only has its own amount
            refunded = int(pay_entity.get("amount_refunded") or refund_entity.get("amount") or 0)
            full = refunded >= row.amount
            row.status = "refunded" if full else "partial_refund"
            if full and row.kind == "pack":
                await credits.revoke_pack(db, row.user_id, row.id)

    if kind == "payment.failed" and pay_entity.get("id"):
        order = await db.scalar(select(CreditOrder).where(CreditOrder.id == pay_entity.get("order_id"))) if pay_entity.get("order_id") else None
        user_id = order.user_id if order else (pay_entity.get("notes") or {}).get("user_id")
        if user_id and await db.get(User, user_id):
            await _record_payment(db, user_id, pay_entity, "pack" if order else "subscription", "Payment failed", order_id=order.id if order else None)

    await db.commit()
    return {"ok": True}
