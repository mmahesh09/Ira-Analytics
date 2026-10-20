"""Feedback -> Google Sheet copy: auth, header row, RAW values, retry after a failure, nothing sent twice."""

import base64
import json
from dataclasses import replace
from urllib.parse import parse_qs, unquote

import httpx
import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from sqlalchemy import func, select

import app.routers.feedback as feedback_router
from app import sheets
from app.config import settings
from app.schema import Feedback
from tests.test_feedback import client, payload

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
ACCOUNT = {
    "client_email": "rankwise-sync@example-project.iam.gserviceaccount.com",
    "token_uri": "https://oauth2.googleapis.com/token",
    "private_key": KEY.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode(),
}


class FakeGoogle:
    def __init__(self, sheet_has_header: bool = False):
        self.appended: list[list] = []
        self.has_header = sheet_has_header
        self.fail_appends = 0
        self.params: list[dict] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        if request.url.host == "oauth2.googleapis.com":
            assertion = parse_qs(request.content.decode())["assertion"][0]
            head, claims, sig = assertion.split(".")
            pad = lambda s: base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))  # noqa: E731
            KEY.public_key().verify(pad(sig), f"{head}.{claims}".encode(), padding.PKCS1v15(), hashes.SHA256())
            assert json.loads(pad(claims))["iss"] == ACCOUNT["client_email"]
            return httpx.Response(200, json={"access_token": "tok", "expires_in": 3600})
        assert request.headers["authorization"] == "Bearer tok"
        path = unquote(request.url.path)
        if request.method == "GET":
            return httpx.Response(200, json={"values": [sheets.HEADER]} if self.has_header or self.appended else {})
        if self.fail_appends:
            self.fail_appends -= 1
            return httpx.Response(503, json={"error": {"message": "backend unavailable"}})
        assert path.endswith("'Feedback'!A1:append")
        self.params.append(dict(request.url.params))
        self.appended.extend(json.loads(request.content)["values"])
        return httpx.Response(200, json={})


@pytest.fixture
def google(monkeypatch):
    monkeypatch.setattr(sheets, "settings", replace(settings, google_sheets_id="sheet123", google_service_account=json.dumps(ACCOUNT)))
    monkeypatch.setattr(sheets, "_token", None)
    monkeypatch.setattr(sheets, "_header_ok", False)
    return FakeGoogle()


async def submit(**overrides):
    async with client() as c:
        r = await c.post("/api/feedback", json=payload(**overrides))
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_disabled_without_configuration(db):
    await submit()
    assert sheets.enabled() is False
    assert await sheets.sync_pending() == 0
    assert await db.scalar(select(func.count()).select_from(Feedback).where(Feedback.sheet_synced_at.is_(None))) == 1


@pytest.mark.asyncio
async def test_rows_are_copied_once_with_a_header(db, google, monkeypatch):
    monkeypatch.setattr(feedback_router, "copy_to_sheet", lambda: None)  # sync explicitly below
    await submit(name="Ada", role="other", role_other="Investor", requested_feature="=HYPERLINK(1)")
    await submit(email="b@example.test", contact_permission=True)

    assert await sheets.sync_pending(httpx.MockTransport(google)) == 2
    assert google.appended[0] == sheets.HEADER
    first = google.appended[1]
    assert first[2] == "Ada" and first[4] == "Other: Investor" and first[15] == "=HYPERLINK(1)"
    assert google.params[0]["valueInputOption"] == "RAW"  # Sheets stores "=..." as text, never a formula
    assert google.appended[2][-1] == "Yes"
    assert await db.scalar(select(func.count()).select_from(Feedback).where(Feedback.sheet_synced_at.is_(None))) == 0

    # nothing new: nothing sent again
    assert await sheets.sync_pending(httpx.MockTransport(google)) == 0
    assert len(google.appended) == 3


@pytest.mark.asyncio
async def test_failed_copy_is_retried_later(db, google, monkeypatch):
    monkeypatch.setattr(feedback_router, "copy_to_sheet", lambda: None)
    await submit()
    google.fail_appends = 1
    assert await sheets.sync_pending(httpx.MockTransport(google)) == 0  # Google down: logged, not raised
    assert await db.scalar(select(func.count()).select_from(Feedback).where(Feedback.sheet_synced_at.is_(None))) == 1
    assert await sheets.sync_pending(httpx.MockTransport(google)) == 1  # the worker's next pass
    assert len([r for r in google.appended if r != sheets.HEADER]) == 1


@pytest.mark.asyncio
async def test_existing_header_is_not_repeated(db, google, monkeypatch):
    monkeypatch.setattr(feedback_router, "copy_to_sheet", lambda: None)
    google.has_header = True
    await submit()
    await sheets.sync_pending(httpx.MockTransport(google))
    assert sheets.HEADER not in google.appended


@pytest.mark.asyncio
async def test_submitting_queues_a_sync(db, monkeypatch):
    calls = []

    async def fake_sync():
        calls.append(1)

    monkeypatch.setattr(feedback_router, "copy_to_sheet", fake_sync)
    await submit()
    assert calls == [1]


def test_base64_key_is_accepted(monkeypatch):
    encoded = base64.b64encode(json.dumps(ACCOUNT).encode()).decode()
    monkeypatch.setattr(sheets, "settings", replace(settings, google_service_account=encoded))
    assert sheets._account()["client_email"] == ACCOUNT["client_email"]
