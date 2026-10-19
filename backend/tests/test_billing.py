import hashlib
import hmac
from dataclasses import replace

import pytest

from app import payments
from app.config import settings
from app.plans import CREDIT_COST, ENTITLED_STATUSES, ENTITLEMENTS, PACKS, PAID_PLANS, PLAN_IDS, PRICES


@pytest.fixture
def secrets(monkeypatch):
    patched = replace(settings, razorpay_key_secret="key-secret", razorpay_webhook_secret="hook-secret")
    monkeypatch.setattr(payments, "settings", patched)
    return patched


def _sig(secret: str, message: bytes) -> str:
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def test_checkout_signature_accepts_genuine(secrets):
    sig = _sig("key-secret", b"pay_123|sub_456")
    assert payments.verify_payment_signature("pay_123", "sub_456", sig)


def test_checkout_signature_rejects_swapped_ids(secrets):
    sig = _sig("key-secret", b"pay_123|sub_456")
    assert not payments.verify_payment_signature("pay_999", "sub_456", sig)
    assert not payments.verify_payment_signature("pay_123", "sub_000", sig)


def test_checkout_signature_rejects_without_secret(monkeypatch):
    monkeypatch.setattr(payments, "settings", replace(settings, razorpay_key_secret=""))
    assert not payments.verify_payment_signature("pay_1", "sub_1", "anything")


def test_webhook_signature_is_over_raw_body(secrets):
    body = b'{"event":"subscription.charged","payload":{}}'
    sig = _sig("hook-secret", body)
    assert payments.verify_webhook_signature(body, sig)
    # re-serialised JSON (spacing differs) must fail: always verify the raw bytes
    assert not payments.verify_webhook_signature(b'{"event": "subscription.charged", "payload": {}}', sig)
    assert not payments.verify_webhook_signature(body, "")


def test_prices_match_the_pricing_page():
    assert PRICES[("pro", "inr")] == 149900 and PRICES[("pro", "usd")] == 1900
    assert PRICES[("business", "inr")] == 599900 and PRICES[("business", "usd")] == 7900
    assert PRICES[("scale", "inr")] == 1199900 and PRICES[("scale", "usd")] == 14900
    assert {p: (PACKS[p].credits, PACKS[p].prices) for p in PACKS} == {
        "pack_5": (5, {"inr": 119900, "usd": 1500}),
        "pack_20": (20, {"inr": 399900, "usd": 4900}),
    }


def test_plan_limits_match_the_pricing_page():
    limits = {p: (e.sites, e.monthly_credits) for p, e in ENTITLEMENTS.items()}
    assert limits == {"free": (1, 1), "pro": (3, 3), "business": (10, 7), "scale": (25, 11)}
    assert CREDIT_COST == {"audit": 1, "deep_audit": 3}


def test_entitlements_grow_with_plan():
    free, pro, business, scale = (ENTITLEMENTS[p] for p in ("free", "pro", "business", "scale"))
    assert free.sites < pro.sites < business.sites < scale.sites
    assert free.monthly_credits < pro.monthly_credits < business.monthly_credits < scale.monthly_credits
    assert free.daily_checks < pro.daily_checks < business.daily_checks < scale.daily_checks
    assert not free.credit_packs and pro.credit_packs and not pro.deep_audit and business.deep_audit
    assert set(ENTITLEMENTS) == set(PLAN_IDS) and set(PAID_PLANS) == set(PLAN_IDS) - {"free"}
    assert "halted" not in ENTITLED_STATUSES and "pending" in ENTITLED_STATUSES
