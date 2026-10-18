import hashlib
import hmac
from dataclasses import replace

import pytest

from app import payments
from app.config import settings
from app.plans import ENTITLED_STATUSES, ENTITLEMENTS, PRICES


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


def test_entitlements_grow_with_plan():
    free, pro, business = ENTITLEMENTS["free"], ENTITLEMENTS["pro"], ENTITLEMENTS["business"]
    assert free.sites < pro.sites < business.sites
    assert not free.google_integrations and pro.google_integrations
    assert "halted" not in ENTITLED_STATUSES and "pending" in ENTITLED_STATUSES
