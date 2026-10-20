"""Copies every feedback submission into a Google Sheet, one row each.

Postgres stays the source of truth: a row is marked `sheet_synced_at` only after Google accepted it, so a failed or
skipped sync (Google down, sheet not configured yet) is retried by the worker and older rows are backfilled.
Authentication is a Google service account (JWT bearer grant, signed here with `cryptography`); share the sheet with the
service account's email as an Editor. Values are written RAW, so a comment starting with "=" stays text, never a formula.
"""

import base64
import json
import logging
import time
from datetime import datetime, timezone
from urllib.parse import quote

import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from sqlalchemy import func, select, text, update

from .config import settings
from .db import SessionLocal, engine
from .schema import Feedback

log = logging.getLogger("rankwise.sheets")

SCOPE = "https://www.googleapis.com/auth/spreadsheets"
API = "https://sheets.googleapis.com/v4/spreadsheets"
LOCK_KEY = 7_311_204  # pg advisory lock: one sync at a time across the API and the worker
BATCH = 500

HEADER = [
    "ID", "Received (UTC)", "Name", "Email", "Role", "Usage", "Satisfaction (1-5)", "Ease of use (1-5)",
    "Recommend (0-10)", "Main goal", "Features used", "Most valuable feature", "Biggest challenge",
    "Likes most", "Should improve", "Feature request", "Other comments", "May contact",
]

_token: tuple[str, float] | None = None  # (access token, expiry as time.time())
_header_ok = False


def enabled() -> bool:
    return bool(settings.google_sheets_id and settings.google_service_account)


def _account() -> dict:
    raw = settings.google_service_account.strip()
    if not raw.startswith("{"):  # base64 of the key file, handy for hosts that mangle multi-line values
        raw = base64.b64decode(raw).decode()
    return json.loads(raw)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


async def _access_token(client: httpx.AsyncClient) -> str:
    global _token
    if _token and _token[1] - 60 > time.time():
        return _token[0]
    account = _account()
    now = int(time.time())
    header = _b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    claims = _b64(json.dumps({"iss": account["client_email"], "scope": SCOPE, "aud": account["token_uri"], "iat": now, "exp": now + 3600}).encode())
    key = serialization.load_pem_private_key(account["private_key"].encode(), password=None)
    signature = key.sign(f"{header}.{claims}".encode(), padding.PKCS1v15(), hashes.SHA256())
    res = await client.post(
        account["token_uri"],
        data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": f"{header}.{claims}.{_b64(signature)}"},
    )
    res.raise_for_status()
    body = res.json()
    _token = (body["access_token"], time.time() + int(body.get("expires_in", 3600)))
    return _token[0]


def _human(value: str | None) -> str:
    """Stored option codes as words: "seo_specialist" -> "Seo specialist"."""
    return value.replace("_", " ").capitalize() if value else ""


def _with_other(choice: str, other: str | None) -> str:
    return f"Other: {other or ''}" if choice == "other" else _human(choice)


def row_values(f: Feedback) -> list:
    created = f.created_at.astimezone(timezone.utc) if f.created_at else datetime.now(timezone.utc)
    return [
        f.id,
        created.strftime("%Y-%m-%d %H:%M:%S"),
        f.name or "",
        f.email or "",
        _with_other(f.role, f.role_other),
        _human(f.usage_frequency),
        f.satisfaction_rating,
        f.usability_rating,
        f.recommendation_score,
        _with_other(f.primary_goal, f.primary_goal_other),
        ", ".join(_human(v) for v in (f.features_used or [])),
        _human(f.most_valuable_feature),
        _with_other(f.biggest_challenge, f.biggest_challenge_other),
        f.positive_feedback or "",
        f.improvement_suggestions or "",
        f.requested_feature or "",
        f.additional_comments or "",
        "Yes" if f.contact_permission else "No",
    ]


def _range(cells: str) -> str:
    tab = settings.google_sheets_tab.replace("'", "''")
    return quote(f"'{tab}'!{cells}", safe="")


async def _append(client: httpx.AsyncClient, rows: list[list]) -> None:
    global _header_ok
    auth = {"Authorization": f"Bearer {await _access_token(client)}"}
    base = f"{API}/{settings.google_sheets_id}/values"
    if not _header_ok:
        first = await client.get(f"{base}/{_range('A1:A1')}", headers=auth)
        first.raise_for_status()
        if not first.json().get("values"):
            rows = [HEADER, *rows]
        _header_ok = True
    res = await client.post(
        f"{base}/{_range('A1')}:append",
        params={"valueInputOption": "RAW", "insertDataOption": "INSERT_ROWS"},
        headers=auth,
        json={"values": rows},
    )
    res.raise_for_status()


async def sync_pending(transport: httpx.AsyncBaseTransport | None = None) -> int:
    """Appends every not-yet-synced feedback row, oldest first. Returns how many rows were sent. Never raises."""
    if not enabled():
        return 0
    try:
        async with engine.connect() as lock_conn:
            if not await lock_conn.scalar(text("SELECT pg_try_advisory_lock(:k)"), {"k": LOCK_KEY}):
                return 0  # another sync is running; it will pick these rows up
            try:
                sent = 0
                async with SessionLocal() as db, httpx.AsyncClient(timeout=20, transport=transport) as client:
                    while True:
                        rows = (await db.scalars(select(Feedback).where(Feedback.sheet_synced_at.is_(None)).order_by(Feedback.id).limit(BATCH))).all()
                        if not rows:
                            return sent
                        await _append(client, [row_values(r) for r in rows])
                        await db.execute(update(Feedback).where(Feedback.id.in_([r.id for r in rows])).values(sheet_synced_at=func.now()))
                        await db.commit()
                        sent += len(rows)
            finally:
                await lock_conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": LOCK_KEY})
    except Exception as exc:  # Google or the network is down: rows stay unsynced and the worker retries
        detail = exc.response.text[:200] if isinstance(exc, httpx.HTTPStatusError) else exc.__class__.__name__
        log.warning("feedback sheet sync failed: %s", detail)
        return 0
