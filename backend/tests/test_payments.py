"""Razorpay integration: checkout verification, webhooks (signatures, duplicates, ordering, renewals, failures),
plan changes and credit packs. Razorpay's HTTP API is stubbed; signatures use test secrets; real local Postgres."""

import asyncio
import hashlib
import hmac
import json
from dataclasses import replace
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from sqlalchemy import func, select

import app.main as main
import app.payments as payments
import app.routers.billing as billing
from app import credits
from app.plans import effective_plan
from app.schema import BillingEvent, CreditGrant, CreditOrder, Payment, Subscription
from tests.conftest import login, make_user

pytestmark = pytest.mark.asyncio
PLANS = {"pro_inr": "plan_pro", "business_inr": "plan_biz", "scale_inr": "plan_scale"}


@pytest.fixture(autouse=True)
def razorpay(monkeypatch):
    patched = replace(billing.settings, razorpay_key_id="rzp_test_x", razorpay_key_secret="key-secret", razorpay_webhook_secret="hook-secret", razorpay_plans=PLANS)
    monkeypatch.setattr(billing, "settings", patched)
    monkeypatch.setattr(payments, "settings", patched)
    return patched


def _sig(secret: str, message: bytes) -> str:
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def client(cookies: dict | None = None) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test", cookies=cookies or {})


def _ts(dt: datetime) -> int:
    return int(dt.timestamp())


NOW = datetime.now(timezone.utc).replace(microsecond=0)
PERIOD = (NOW - timedelta(days=1), NOW + timedelta(days=29))


def sub_entity(status="active", plan="plan_pro", start=PERIOD[0], end=PERIOD[1], sub_id="sub_1"):
    return {"id": sub_id, "status": status, "plan_id": plan, "current_start": _ts(start), "current_end": _ts(end)}


async def hook(c: httpx.AsyncClient, event: str, event_id: str | None, created: datetime = NOW, signature: str | None = None, **payload) -> httpx.Response:
    body = json.dumps({"event": event, "created_at": _ts(created), "payload": {k: {"entity": v} for k, v in payload.items()}}).encode()
    headers = {"x-razorpay-signature": signature if signature is not None else _sig("hook-secret", body), "content-type": "application/json"}
    if event_id:
        headers["x-razorpay-event-id"] = event_id
    return await c.post("/api/webhooks/razorpay", content=body, headers=headers)


async def subscribed(db, user: str, status="created", plan="pro", rzp_plan="plan_pro") -> Subscription:
    sub = Subscription(user_id=user, plan_id=plan, currency="inr", razorpay_subscription_id="sub_1", razorpay_plan_id=rzp_plan, status=status)
    db.add(sub)
    await db.commit()
    return sub


async def _monthly(db, user: str) -> int:
    return (await credits.balance(db, user)).monthly


async def test_webhook_rejects_bad_signature_and_missing_event_id(db):
    async with client() as c:
        assert (await hook(c, "subscription.charged", "evt_1", signature="nope")).status_code == 400
        assert (await hook(c, "subscription.charged", None)).status_code == 400
    assert await db.scalar(select(func.count()).select_from(BillingEvent)) == 0


async def test_charged_grants_once_even_for_duplicate_and_concurrent_deliveries(db):
    user = await make_user(db)
    await subscribed(db, user)
    pay = {"id": "pay_1", "status": "captured", "amount": 149900, "currency": "INR", "created_at": _ts(NOW)}
    async with client() as c:
        first = await hook(c, "subscription.charged", "evt_charge", subscription=sub_entity(), payment=pay)
        replays = await asyncio.gather(*(hook(c, "subscription.charged", "evt_charge", subscription=sub_entity(), payment=pay) for _ in range(5)))
        # a different event for the same period (activated arrives too) must not grant again
        await hook(c, "subscription.activated", "evt_activated", subscription=sub_entity())
    assert first.json() == {"ok": True} and all(r.json()["duplicate"] for r in replays)
    assert await _monthly(db, user) == 3
    assert await db.scalar(select(func.count()).select_from(Payment)) == 1
    assert await effective_plan(db, user) == "pro"


async def test_out_of_order_events_are_ignored(db):
    user = await make_user(db)
    await subscribed(db, user)
    async with client() as c:
        await hook(c, "subscription.charged", "evt_new", created=NOW, subscription=sub_entity())
        await hook(c, "subscription.halted", "evt_old", created=NOW - timedelta(hours=2), subscription=sub_entity(status="halted"))
    sub = await db.scalar(select(Subscription).execution_options(populate_existing=True))
    assert sub.status == "active"


async def test_renewal_grants_the_new_period_and_failures_downgrade(db):
    user = await make_user(db)
    await subscribed(db, user)
    async with client() as c:
        await hook(c, "subscription.charged", "evt_p1", created=NOW - timedelta(minutes=5), subscription=sub_entity())
        renewed = sub_entity(start=NOW - timedelta(minutes=1), end=NOW + timedelta(days=30))
        await hook(c, "subscription.charged", "evt_p2", created=NOW, subscription=renewed)
        assert await db.scalar(select(func.count()).select_from(CreditGrant).where(CreditGrant.source == "monthly")) == 2

        await hook(c, "subscription.pending", "evt_pending", created=NOW + timedelta(seconds=1), subscription={**renewed, "status": "pending"})
        assert await effective_plan(db, user) == "pro"  # grace period keeps the plan
        await hook(c, "subscription.halted", "evt_halted", created=NOW + timedelta(seconds=2), subscription={**renewed, "status": "halted"})
    assert await effective_plan(db, user) == "free"
    assert await db.scalar(select(func.count()).select_from(CreditGrant).where(CreditGrant.source == "monthly")) == 2  # nothing clawed back


async def test_checkout_verify_grants_once_and_the_webhook_adds_nothing(db, monkeypatch):
    user = await make_user(db)
    await subscribed(db, user)

    async def fake_fetch(subscription_id):
        return sub_entity()

    monkeypatch.setattr(payments, "fetch_subscription", fake_fetch)
    body = {"razorpay_payment_id": "pay_9", "razorpay_subscription_id": "sub_1", "razorpay_signature": _sig("key-secret", b"pay_9|sub_1")}
    async with client(await login(db, user)) as c:
        bad = await c.post("/api/billing/verify", json={**body, "razorpay_signature": "forged"})
        assert bad.status_code == 400 and await _monthly(db, user) == 0
        state = (await c.post("/api/billing/verify", json=body)).json()
        again = (await c.post("/api/billing/verify", json=body)).json()
        await hook(c, "subscription.charged", "evt_after_verify", subscription=sub_entity())
    assert state["plan"] == "pro" and state["credits"]["monthly"] == 3 and again["credits"]["monthly"] == 3
    assert await _monthly(db, user) == 3


async def test_upgrade_tops_up_once_and_downgrade_waits_for_period_end(db, monkeypatch):
    user = await make_user(db)
    await subscribed(db, user)
    calls = []

    async def fake_update(subscription_id, plan_id, when):
        calls.append(when)
        return sub_entity(plan=plan_id)

    monkeypatch.setattr(payments, "update_subscription", fake_update)
    async with client(await login(db, user)) as c:
        await hook(c, "subscription.charged", "evt_c", subscription=sub_entity())
        up = (await c.post("/api/billing/change-plan", json={"plan": "business"})).json()
        # Razorpay then reports the same change: no second top-up
        await hook(c, "subscription.updated", "evt_u", created=NOW + timedelta(seconds=5), subscription=sub_entity(plan="plan_biz"))
        assert up["plan"] == "business" and up["credits"]["monthly"] == 7  # 3 + (7 - 3)
        assert await _monthly(db, user) == 7

        down = (await c.post("/api/billing/change-plan", json={"plan": "pro"})).json()
    assert calls == ["now", "cycle_end"]
    assert down["plan"] == "business" and down["scheduled_plan"] == "pro"


async def test_credit_packs_are_server_priced_owned_and_granted_once(db, monkeypatch):
    buyer, other, free_user = await make_user(db, "u_buyer"), await make_user(db, "u_other"), await make_user(db, "u_free")
    db.add(Subscription(user_id=buyer, plan_id="pro", currency="inr", razorpay_subscription_id="sub_b", razorpay_plan_id="plan_pro",
                        status="active", current_start=PERIOD[0], current_end=PERIOD[1]))
    await db.commit()

    async def fake_order(amount, currency, receipt, notes):
        return {"id": "order_1", "amount": amount, "currency": currency.upper()}

    monkeypatch.setattr(payments, "create_order", fake_order)
    async with client(await login(db, free_user)) as c:
        assert (await c.post("/api/billing/packs/pack_5/order", json={"currency": "inr"})).status_code == 403
    async with client(await login(db, buyer)) as c:
        order = (await c.post("/api/billing/packs/pack_5/order", json={"currency": "inr", "amount": 1})).json()
        assert order["amount"] == 119900 and order["credits"] == 5  # a client-sent amount is ignored
        body = {"razorpay_order_id": "order_1", "razorpay_payment_id": "pay_p", "razorpay_signature": _sig("key-secret", b"order_1|pay_p")}
        assert (await c.post("/api/billing/packs/verify", json={**body, "razorpay_signature": "forged"})).status_code == 400
        state = (await c.post("/api/billing/packs/verify", json=body)).json()
        await hook(c, "order.paid", "evt_order", order={"id": "order_1"}, payment={"id": "pay_p", "status": "captured", "amount": 119900, "currency": "INR"})
        history = (await c.get("/api/billing/payments")).json()
    async with client(await login(db, other)) as c:
        assert (await c.post("/api/billing/packs/verify", json=body)).status_code == 404
    assert state["credits"]["pack"] == 5 and (await credits.balance(db, buyer)).pack == 5
    assert [(p["kind"], p["amount"], p["status"]) for p in history] == [("pack", 119900, "captured")]
    assert (await db.get(CreditOrder, "order_1", populate_existing=True)).status == "paid"


async def test_refund_marks_payment_and_takes_back_an_unused_pack_once(db):
    user = await make_user(db)
    await credits.grant(db, user, "pack", 5, "pack:pay_r", expires_at=NOW + timedelta(days=365), payment_id="pay_r")
    db.add(Payment(id="pay_r", user_id=user, kind="pack", amount=119900, currency="inr", status="captured", paid_at=NOW))
    await db.commit()
    pay = {"id": "pay_r", "status": "captured", "amount": 119900, "currency": "INR"}
    async with client() as c:
        await hook(c, "refund.processed", "evt_rf1", refund={"id": "rfnd_1", "payment_id": "pay_r", "amount": 50000}, payment={**pay, "amount_refunded": 50000})
        partial = (await db.get(Payment, "pay_r", populate_existing=True)).status
        assert (await credits.balance(db, user)).pack == 5  # a partial refund (e.g. a goodwill credit) keeps the pack
        await hook(c, "refund.processed", "evt_rf2", refund={"id": "rfnd_2", "payment_id": "pay_r", "amount": 69900},
                   payment={**pay, "status": "refunded", "amount_refunded": 119900})
        await hook(c, "refund.processed", "evt_rf3", refund={"id": "rfnd_x", "payment_id": "pay_unknown", "amount": 100})
    assert partial == "partial_refund"
    assert (await db.get(Payment, "pay_r", populate_existing=True)).status == "refunded"
    assert (await credits.balance(db, user)).pack == 0
    assert await credits.revoke_pack(db, user, "pay_r") == 0  # repeat is a no-op
