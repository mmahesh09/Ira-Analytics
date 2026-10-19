"""Razorpay REST client (Subscriptions + Plans) and signature checks. Keys never leave the backend."""

import hashlib
import hmac
from datetime import datetime, timezone
from typing import Any

import httpx

from .config import settings

API = "https://api.razorpay.com/v1"


class PaymentsError(Exception):
    """Razorpay rejected a request or isn't configured; message is safe to show."""


def configured() -> bool:
    return bool(settings.razorpay_key_id and settings.razorpay_key_secret)


async def _request(method: str, path: str, json: dict | None = None, params: dict | None = None) -> dict[str, Any]:
    if not configured():
        raise PaymentsError("Payments aren't set up yet.")
    async with httpx.AsyncClient(base_url=API, auth=(settings.razorpay_key_id, settings.razorpay_key_secret), timeout=20) as client:
        res = await client.request(method, path, json=json, params=params)
    if res.status_code >= 400:
        try:
            description = res.json()["error"]["description"]
        except (ValueError, KeyError, TypeError):
            description = res.text[:200]
        raise PaymentsError(f"Razorpay: {description}")
    return res.json()


async def create_plan(name: str, amount: int, currency: str, description: str) -> dict:
    item = {"name": name, "amount": amount, "currency": currency.upper(), "description": description}
    return await _request("POST", "/plans", json={"period": "monthly", "interval": 1, "item": item})


async def list_plans() -> list[dict]:
    return (await _request("GET", "/plans", params={"count": 100}))["items"]


async def create_subscription(razorpay_plan_id: str, notes: dict[str, str]) -> dict:
    # total_count = maximum number of monthly charges before the subscription ends (10 years)
    return await _request("POST", "/subscriptions", json={"plan_id": razorpay_plan_id, "total_count": 120, "quantity": 1, "customer_notify": 1, "notes": notes})


async def fetch_subscription(subscription_id: str) -> dict:
    return await _request("GET", f"/subscriptions/{subscription_id}")


async def cancel_subscription(subscription_id: str) -> dict:
    """Stops renewal; the customer keeps the plan until the current period ends."""
    return await _request("POST", f"/subscriptions/{subscription_id}/cancel", json={"cancel_at_cycle_end": 1})


async def update_subscription(subscription_id: str, razorpay_plan_id: str, schedule_change_at: str) -> dict:
    """Switches plan: "now" (upgrade) or "cycle_end" (downgrade). Razorpay refuses this for some payment
    methods (e.g. UPI Autopay mandates); the error message is passed on as a PaymentsError."""
    return await _request(
        "PATCH", f"/subscriptions/{subscription_id}",
        json={"plan_id": razorpay_plan_id, "quantity": 1, "schedule_change_at": schedule_change_at, "customer_notify": 1},
    )


async def create_order(amount: int, currency: str, receipt: str, notes: dict[str, str]) -> dict:
    """One-time payment (credit packs). amount is in the smallest unit (paise / cents)."""
    return await _request("POST", "/orders", json={"amount": amount, "currency": currency.upper(), "receipt": receipt[:40], "notes": notes})


async def fetch_payment(payment_id: str) -> dict:
    return await _request("GET", f"/payments/{payment_id}")


def _hmac(secret: str, message: bytes) -> str:
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def verify_payment_signature(payment_id: str, subscription_id: str, signature: str) -> bool:
    """Checkout success handler: signature = HMAC_SHA256(payment_id + "|" + subscription_id, key_secret)."""
    if not settings.razorpay_key_secret:
        return False
    expected = _hmac(settings.razorpay_key_secret, f"{payment_id}|{subscription_id}".encode())
    return hmac.compare_digest(expected, signature)


def verify_order_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Checkout success for an Order: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)."""
    if not settings.razorpay_key_secret or not signature:
        return False
    return hmac.compare_digest(_hmac(settings.razorpay_key_secret, f"{order_id}|{payment_id}".encode()), signature)


def verify_webhook_signature(raw_body: bytes, signature: str) -> bool:
    """Webhook: X-Razorpay-Signature = HMAC_SHA256(raw request body, webhook secret)."""
    if not settings.razorpay_webhook_secret or not signature:
        return False
    return hmac.compare_digest(_hmac(settings.razorpay_webhook_secret, raw_body), signature)


def ts(value: int | None) -> datetime | None:
    """Razorpay timestamps are unix seconds."""
    return datetime.fromtimestamp(value, tz=timezone.utc) if value else None
