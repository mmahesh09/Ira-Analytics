import asyncio
import json
import re
import time
from collections import defaultdict, deque

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from sqlalchemy import text

from .accessibility import SHOTS_DIR
from .config import settings
from .db import engine
from .models import AuditRequest
from .routers import auth, billing, monitoring, sites
from .runner import run_audit

app = FastAPI(title="Rankwise API", version="0.2.0")
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

_hits: dict[str, deque[float]] = defaultdict(deque)
WINDOW = 600


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    return forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")


def _allow(request: Request) -> bool:
    hits = _hits[_client_ip(request)]
    now = time.time()
    while hits and now - hits[0] > WINDOW:
        hits.popleft()
    if len(hits) >= settings.rate_limit_per_10min:
        return False
    hits.append(now)
    return True


def _sse(event: dict) -> str:
    return f"event: {event['type']}\ndata: {json.dumps(event, default=str)}\n\n"


SHOT_NAME = re.compile(r"^[0-9a-f]{32}\.jpg$")


@app.get("/api/shots/{name}")
def screenshot(name: str):
    """Visual Website Doctor screenshots (random 128-bit names, so they can't be guessed or enumerated)."""
    path = SHOTS_DIR / name
    if not SHOT_NAME.match(name) or not path.is_file():
        raise HTTPException(404, "Screenshot not found.")
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=604800, immutable"})


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
async def audit_stream(request: Request, url: str = Query(min_length=3, max_length=2048)):
    allowed = _allow(request)

    async def events():
        if not allowed:
            yield _sse({"type": "error", "message": "You've run a lot of audits. Please wait a few minutes and try again."})
            return
        async for event in run_audit(url):
            if await request.is_disconnected():
                return
            yield _sse(event)

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/api/audit")
async def audit(body: AuditRequest, request: Request):
    if not _allow(request):
        raise HTTPException(429, "Too many audits. Try again in a few minutes.")
    async for event in run_audit(body.url):
        if event["type"] == "error":
            raise HTTPException(422, event["message"])
        if event["type"] == "result":
            return event["report"]
    raise HTTPException(500, "Audit did not complete.")
