"""Razorpay subscriptions: state, subscribe, verify checkout, cancel, webhook."""

import json
import logging
from dataclasses import asdict
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import payments
from ..auth import current_user
from ..config import settings
from ..db import get_session
from ..plans import ENTITLED_STATUSES, ENTITLEMENTS, current_subscription
from ..schema import BillingEvent, Subscription, User

router = APIRouter(tags=["billing"])
log = logging.getLogger("rankwise.billing")

PlanName = Literal["pro", "business"]
CurrencyName = Literal["inr", "usd"]


class BillingOut(BaseModel):
    plan: str
    status: str | None
    currency: str | None
    current_end: datetime | None
    cancel_at_cycle_end: bool
    entitlements: dict
    payments_enabled: bool
    usd_enabled: bool


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


def _apply(sub: Subscription, entity: dict) -> None:
    """Copies Razorpay's view of a subscription onto our row."""
    sub.status = entity.get("status", sub.status)
    sub.current_start = payments.ts(entity.get("current_start")) or sub.current_start
    sub.current_end = payments.ts(entity.get("current_end")) or sub.current_end
    if entity.get("status") in ("cancelled", "completed", "expired"):
        sub.cancel_at_cycle_end = False


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
    plan = sub.plan_id if entitled else "free"
    return BillingOut(
        plan=plan,
        status=sub.status if sub else None,
        currency=sub.currency if sub else None,
        current_end=sub.current_end if entitled else None,
        cancel_at_cycle_end=bool(sub and entitled and sub.cancel_at_cycle_end),
        entitlements=asdict(ENTITLEMENTS[plan]),
        payments_enabled=payments.configured() and bool(settings.razorpay_plans),
        usd_enabled=settings.razorpay_usd_enabled,
    )


@router.get("/api/billing", response_model=BillingOut)
async def billing(user: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    return await _state(db, user)


@router.post("/api/billing/subscribe", response_model=SubscribeOut)
async def subscribe(body: SubscribeIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    if body.currency == "usd" and not settings.razorpay_usd_enabled:
        raise HTTPException(422, "USD payments aren't available yet. Choose INR.")
    razorpay_plan_id = settings.razorpay_plans.get(f"{body.plan}_{body.currency}")
    if not payments.configured() or not razorpay_plan_id:
        raise HTTPException(503, "Payments aren't set up yet. Please try again later.")

    latest = await current_subscription(db, user.id)
    if latest and latest.status in ENTITLED_STATUSES:
        raise HTTPException(409, f"You're already on {latest.plan_id.title()}. Cancel it first to switch plans.")
    # reuse an unpaid checkout for the same plan instead of piling up subscriptions
    if latest and latest.status == "created" and latest.razorpay_plan_id == razorpay_plan_id:
        sub = latest
    else:
        try:
            entity = await payments.create_subscription(razorpay_plan_id, {"user_id": user.id, "plan": body.plan, "currency": body.currency})
        except payments.PaymentsError as exc:
            raise HTTPException(502, str(exc)) from None
        sub = Subscription(
            user_id=user.id,
            plan_id=body.plan,
            currency=body.currency,
            razorpay_subscription_id=entity["id"],
            razorpay_plan_id=razorpay_plan_id,
            status=entity.get("status", "created"),
        )
        db.add(sub)
        await db.commit()

    return SubscribeOut(
        subscription_id=sub.razorpay_subscription_id,
        key_id=settings.razorpay_key_id,
        plan=sub.plan_id,
        currency=sub.currency,
        prefill={"name": user.name or "", "email": user.email},
    )


@router.post("/api/billing/verify", response_model=BillingOut)
async def verify(body: VerifyIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    sub = await db.scalar(select(Subscription).where(Subscription.razorpay_subscription_id == body.razorpay_subscription_id, Subscription.user_id == user.id))
    if not sub:
        raise HTTPException(404, "Subscription not found.")
    if not payments.verify_payment_signature(body.razorpay_payment_id, body.razorpay_subscription_id, body.razorpay_signature):
        log.warning("bad checkout signature for %s", body.razorpay_subscription_id)
        raise HTTPException(400, "We couldn't verify that payment. If you were charged, it will be confirmed automatically within a few minutes.")
    if sub.status == "created":
        sub.status = "authenticated"
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


@router.post("/api/webhooks/razorpay", include_in_schema=False)
async def razorpay_webhook(request: Request, db: AsyncSession = Depends(get_session)):
    raw = await request.body()
    if not payments.verify_webhook_signature(raw, request.headers.get("x-razorpay-signature", "")):
        raise HTTPException(400, "Invalid signature.")
    event = json.loads(raw)
    event_id = request.headers.get("x-razorpay-event-id") or f"{event.get('event')}:{event.get('created_at')}"
    if await db.get(BillingEvent, event_id):
        return {"ok": True, "duplicate": True}

    entity = (event.get("payload", {}).get("subscription") or {}).get("entity") or {}
    if entity.get("id"):
        sub = await db.scalar(select(Subscription).where(Subscription.razorpay_subscription_id == entity["id"]))
        if sub:
            _apply(sub, entity)
        else:
            log.warning("webhook for unknown subscription %s", entity["id"])
    db.add(BillingEvent(id=event_id, type=event.get("event", ""), payload=event))
    await db.commit()
    return {"ok": True}
