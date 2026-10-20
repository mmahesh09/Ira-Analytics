"""Request rate limits in Postgres (fixed windows): every instance and restart shares the same counts.

Counters are written on their own short transaction, so a 429 never rolls back (or is rolled back by) the
request's own work. Keys are user ids or salted IP hashes, never raw IPs.
"""

import hashlib
import random
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert

from .config import settings
from .db import engine
from .schema import ApiRate


def client_ip(request: Request) -> str:
    """The caller's IP. X-Forwarded-For is client-controlled except for the entries our own proxies append,
    so only the entry added by the outermost of TRUSTED_PROXY_HOPS proxies is trusted (Render: 1)."""
    hops = settings.trusted_proxy_hops
    forwarded = [part.strip() for part in request.headers.get("x-forwarded-for", "").split(",") if part.strip()]
    if hops > 0 and len(forwarded) >= hops:
        return forwarded[-hops]
    return request.client.host if request.client else "unknown"


def ip_key(scope: str, ip: str) -> str:
    return f"{scope}:{hashlib.sha256(f'{settings.preview_salt}|{ip}'.encode()).hexdigest()[:32]}"


async def hit(key: str, limit: int, window: int = 60) -> None:
    """Counts one request against `key`; raises 429 (with Retry-After) once `limit` is passed in this window."""
    now = datetime.now(timezone.utc)
    epoch = int(now.timestamp())
    start = datetime.fromtimestamp(epoch - epoch % window, tz=timezone.utc)
    async with engine.begin() as conn:
        count = await conn.scalar(
            pg_insert(ApiRate).values(key=key[:96], window_start=start, count=1)
            .on_conflict_do_update(index_elements=["key", "window_start"], set_={"count": ApiRate.count + 1})
            .returning(ApiRate.count)
        )
        if random.random() < 0.01:  # old windows are useless; sweep them now and then
            await conn.execute(delete(ApiRate).where(ApiRate.window_start < now - timedelta(hours=1)))
    if count > limit:
        raise HTTPException(429, "Too many requests. Wait a moment and try again.", headers={"Retry-After": str(window - epoch % window)})
