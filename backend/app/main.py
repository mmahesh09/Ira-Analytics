import asyncio
import hashlib
import json
import re
import logging
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .credits import lock_user
from .db import engine, get_session
from .models import AuditRequest
from .schema import PreviewUsage
from .routers import auth, billing, content, monitoring, sites
from .runner import run_audit
from .storage import load_shot
from .worker import run_forever

@asynccontextmanager
async def lifespan(_: FastAPI):
    # single-container hosts (Render free tier): run scheduled audits and queued jobs in this process
    task = asyncio.create_task(run_forever()) if settings.embedded_worker else None
    if task and not logging.getLogger().handlers:
        # uvicorn only configures its own loggers; give the worker's log lines somewhere to go
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    try:
        yield
    finally:
        if task:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task


app = FastAPI(title="Rankwise API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)
app.include_router(auth.router)
app.include_router(sites.router)
app.include_router(billing.router)
app.include_router(monitoring.router)
app.include_router(content.router)

def _client_ip(request: Request) -> str:
    """The caller's IP. X-Forwarded-For is client-controlled except for the entries our own proxies append,
    so only the entry added by the outermost of TRUSTED_PROXY_HOPS proxies is trusted (Render: 1)."""
    hops = settings.trusted_proxy_hops
    forwarded = [part.strip() for part in request.headers.get("x-forwarded-for", "").split(",") if part.strip()]
    if hops > 0 and len(forwarded) >= hops:
        return forwarded[-hops]
    return request.client.host if request.client else "unknown"


async def _take_preview(db: AsyncSession, request: Request) -> str | None:
    """Counts one anonymous preview; returns the reason it's refused, or None. Stored in Postgres, so the
    limit survives restarts and holds across instances; IPs are kept only as salted hashes."""
    today = datetime.now(timezone.utc).date()
    ip_hash = hashlib.sha256(f"{settings.preview_salt}|{_client_ip(request)}".encode()).hexdigest()
    await lock_user(db, "all", "preview")  # makes the global daily cap exact
    if (await db.scalar(select(func.coalesce(func.sum(PreviewUsage.count), 0)).where(PreviewUsage.day == today))) >= settings.preview_daily_cap:
        await db.rollback()
        return "Free previews are busy today. Create a free account for your monthly full audit."
    taken = await db.scalar(
        pg_insert(PreviewUsage).values(ip_hash=ip_hash, day=today, count=1)
        .on_conflict_do_update(
            index_elements=["ip_hash", "day"], set_={"count": PreviewUsage.count + 1},
            where=PreviewUsage.count < settings.preview_per_ip_per_day,
        )
        .returning(PreviewUsage.count)
    )
    if taken is None:
        await db.rollback()
        return "You've used today's free previews. Create a free account for a full audit every month."
    await db.commit()
    return None


def _sse(event: dict) -> str:
    return f"event: {event['type']}\ndata: {json.dumps(event, default=str)}\n\n"


SHOT_NAME = re.compile(r"^[0-9a-f]{32}\.jpg$")


@app.get("/api/shots/{name}")
async def screenshot(name: str):
    """Visual Website Doctor screenshots (random 128-bit names, so they can't be guessed or enumerated)."""
    data = await load_shot(name) if SHOT_NAME.match(name) else None
    if data is None:
        raise HTTPException(404, "Screenshot not found.")
    return Response(data, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=604800, immutable"})


@app.get("/api/health")
async def health():
    try:
        async with engine.connect() as conn:
            await asyncio.wait_for(conn.execute(text("SELECT 1")), timeout=3)
        database = "ok"
    except Exception as exc:  # report, don't crash: health must answer even when the DB is down
        database = f"unreachable ({exc.__class__.__name__})"
    return {
        "status": "ok" if database == "ok" else "degraded",
        "database": database,
        "features": {
            "ai_visibility": bool(settings.openrouter_api_key),
            "traffic": bool(settings.dataforseo_login and settings.dataforseo_password),
            "pagespeed_key": bool(settings.pagespeed_api_key),
        },
    }


@app.get("/api/audit/stream")
async def audit_stream(request: Request, url: str = Query(min_length=3, max_length=2048), db: AsyncSession = Depends(get_session)):
    """Anonymous preview: a light check (no Speed, browser, traffic or AI probes), not saved, a few per day."""
    refused = await _take_preview(db, request)

    async def events():
        if refused:
            yield _sse({"type": "error", "message": refused})
            return
        async for event in run_audit(url, mode="light"):
            if await request.is_disconnected():
                return
            yield _sse(event)

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/api/audit")
async def audit(body: AuditRequest, request: Request, db: AsyncSession = Depends(get_session)):
    if refused := await _take_preview(db, request):
        raise HTTPException(429, refused)
    async for event in run_audit(body.url, mode="light"):
        if event["type"] == "error":
            raise HTTPException(422, event["message"])
        if event["type"] == "result":
            return event["report"]
    raise HTTPException(500, "Audit did not complete.")
