"""Monitoring API: health history, issues, broken links, audit-now, deploy webhook and the alerts inbox."""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .. import credits, jobs, ratelimit
from ..auth import current_user, owned_site
from ..config import settings
from ..priority import CONFIDENCE, DEFAULT_CONFIDENCE, DEFAULT_EFFORT, EFFORT
from ..db import get_session
from ..monitoring import module_score
from ..plans import ENTITLEMENTS, effective_plan
from ..schema import Alert, Audit, Issue, Job, LinkCheck, Site, User, Verification

router = APIRouter(tags=["monitoring"])
DEPLOY_COOLDOWN = timedelta(hours=1)
LIGHT_MODULES = ("seo", "aeo", "geo")  # modules a light check measures


class AuditPoint(BaseModel):
    id: int
    created_at: datetime
    trigger: str
    kind: str = "full"  # full | deep | check
    overall: int
    seo: int | None
    aeo: int | None
    geo: int | None
    speed: int | None


class IssueOut(BaseModel):
    id: int
    module: str
    title: str
    severity: str
    status: str
    first_seen_at: datetime
    last_seen_at: datetime
    resolved_at: datetime | None
    # Smart Issue Prioritization, looked up by check id
    effort: int = DEFAULT_EFFORT
    confidence: float = DEFAULT_CONFIDENCE


class LinkOut(BaseModel):
    url: str
    source_url: str
    internal: bool
    ok: bool
    status_code: int | None
    error: str | None
    first_broken_at: datetime | None
    last_checked_at: datetime


class StatusOut(BaseModel):
    running: list[str]
    queued: list[str]
    last_audit_at: datetime | None
    next_audit_at: datetime | None


class AlertOut(BaseModel):
    id: int
    site_id: int
    site_name: str
    kind: str
    message: str
    read: bool
    created_at: datetime


# ---------- history & issues ----------

HISTORY_KINDS = {"full": ("full", "deep"), "check": ("check",), "all": ("full", "deep", "check")}


@router.get("/api/sites/{site_id}/history", response_model=list[AuditPoint])
async def history(site: Site = Depends(owned_site), db: AsyncSession = Depends(get_session), limit: int = Query(90, ge=1, le=365),
                  kind: Literal["full", "check", "all"] = "full"):
    """Score history. Full audits by default: light checks have no Speed and a differently weighted overall."""
    rows = await db.scalars(
        select(Audit).where(Audit.site_id == site.id, Audit.kind.in_(HISTORY_KINDS[kind])).order_by(Audit.created_at.desc()).limit(limit)
    )
    return [
        AuditPoint(id=a.id, created_at=a.created_at, trigger=a.trigger, kind=a.kind, overall=a.overall_score, seo=a.seo, aeo=a.aeo, geo=a.geo, speed=a.speed)
        for a in reversed(list(rows))
    ]


@router.get("/api/sites/{site_id}/audits/{audit_id}")
async def audit_report(audit_id: int, site: Site = Depends(owned_site), db: AsyncSession = Depends(get_session)):
    audit = await db.get(Audit, audit_id)
    if not audit or audit.site_id != site.id:
        raise HTTPException(404, "Audit not found.")
    return audit.report


@router.get("/api/sites/{site_id}/issues", response_model=list[IssueOut])
async def issues(site: Site = Depends(owned_site), db: AsyncSession = Depends(get_session), status: Literal["open", "resolved", "all"] = "open"):
    query = select(Issue).where(Issue.site_id == site.id)
    if status != "all":
        query = query.where(Issue.status == status)
    order = Issue.resolved_at.desc() if status == "resolved" else Issue.first_seen_at.desc()
    return [
        IssueOut.model_validate(i, from_attributes=True).model_copy(
            update={"effort": EFFORT.get(i.check_id, DEFAULT_EFFORT), "confidence": CONFIDENCE.get(i.check_id, DEFAULT_CONFIDENCE)}
        )
        for i in await db.scalars(query.order_by(order).limit(500))
    ]


@router.get("/api/sites/{site_id}/links", response_model=list[LinkOut])
async def links(site: Site = Depends(owned_site), db: AsyncSession = Depends(get_session), broken: bool = True):
    query = select(LinkCheck).where(LinkCheck.site_id == site.id)
    if broken:
        query = query.where(LinkCheck.ok.is_(False))
    return [LinkOut.model_validate(r, from_attributes=True) for r in await db.scalars(query.order_by(LinkCheck.first_broken_at.desc().nullslast()).limit(1000))]


# ---------- run now & status ----------

class AuditNowIn(BaseModel):
    deep: bool = False


async def _queue_paid_audit(db: AsyncSession, site: Site, kind: str, key: str, trigger: str) -> dict:
    """Reserves credits and queues the audit in one transaction. Raises InsufficientCredits."""
    site_id, owner_id = site.id, site.owner_id
    await credits.lock_user(db, owner_id)
    if await jobs.pending(db, "audit", site_id):
        await db.rollback()
        return {"queued": False, "reason": "already_queued"}
    reservation = await credits.reserve(db, owner_id, kind, key, site_id)
    status, cost = reservation.status, reservation.cost  # read before any rollback expires the row
    if status != "held":  # the same request was already processed
        await db.rollback()
        return {"queued": False, "reason": f"already_{status}"}
    jobs.add(db, "audit", {"site_id": site_id, "trigger": trigger, "reservation_id": reservation.id})
    await db.commit()
    return {"queued": True, "credits_charged": cost, "credits_left": (await credits.balance(db, owner_id)).total}


@router.post("/api/sites/{site_id}/audits", status_code=202)
async def audit_now(
    body: AuditNowIn | None = None,
    idempotency_key: str | None = Header(default=None, max_length=64),
    site: Site = Depends(owned_site),
    db: AsyncSession = Depends(get_session),
):
    """Full audit (1 credit) or deep audit (3 credits, Business and Scale). Charged when the report is stored;
    refunded automatically if no report comes out. A repeated Idempotency-Key is never charged twice."""
    deep = bool(body and body.deep)
    plan_id = await effective_plan(db, site.owner_id)
    if deep and not ENTITLEMENTS[plan_id].deep_audit:
        raise HTTPException(403, "Deep audits (up to 500 pages) are part of Business and Scale.")
    kind = "deep_audit" if deep else "audit"
    key = f"manual:{site.owner_id}:{idempotency_key}" if idempotency_key else f"manual:{site.id}:{secrets.token_hex(8)}"
    try:
        return await _queue_paid_audit(db, site, kind, key, "manual")
    except credits.InsufficientCredits as exc:
        await db.rollback()
        raise HTTPException(402, f"{exc} Upgrade or buy a credit pack in Billing; light checks are still free.") from None


@router.post("/api/sites/{site_id}/check", status_code=202)
async def check_now(site: Site = Depends(owned_site), db: AsyncSession = Depends(get_session)):
    """Light check (SEO, AEO and GEO rules; no credits), within the plan's daily allowance."""
    job, reason = await jobs.enqueue_check(db, site, "manual")
    if reason == "daily_limit":
        raise HTTPException(429, "You've used today's light checks. They reset at midnight UTC.")
    return {"queued": job is not None}


# ---------- Before-and-After Verification ----------

class VerificationOut(BaseModel):
    id: int
    issue_id: int
    title: str
    module: str
    status: str
    check_status: str | None
    before_overall: int | None
    after_overall: int | None
    before_module: int | None
    after_module: int | None
    requested_at: datetime
    finished_at: datetime | None


def _verification_out(v: Verification, issue: Issue) -> VerificationOut:
    return VerificationOut(
        id=v.id, issue_id=issue.id, title=issue.title, module=issue.module, status=v.status, check_status=v.check_status,
        before_overall=v.before_overall, after_overall=v.after_overall, before_module=v.before_module, after_module=v.after_module,
        requested_at=v.requested_at, finished_at=v.finished_at,
    )


@router.post("/api/sites/{site_id}/issues/{issue_id}/verify", response_model=VerificationOut, status_code=202)
async def verify_issue(issue_id: int, site: Site = Depends(owned_site), db: AsyncSession = Depends(get_session)):
    """ "Mark fixed": queue a fresh audit that confirms the fix, keeping the numbers from before for comparison."""
    issue = await db.get(Issue, issue_id)
    if not issue or issue.site_id != site.id:
        raise HTTPException(404, "Issue not found.")
    if issue.status != "open":
        raise HTTPException(409, "This issue is already resolved.")
    existing = await db.scalar(select(Verification).where(Verification.issue_id == issue.id, Verification.status == "queued"))
    if existing:
        return _verification_out(existing, issue)

    before = await db.get(Audit, issue.last_audit_id) if issue.last_audit_id else None
    v = Verification(
        site_id=site.id, issue_id=issue.id, before_audit_id=before.id if before else None,
        before_overall=before.overall_score if before else None,
        before_module=module_score(before.report if before else None, issue.module),
    )
    db.add(v)
    await db.commit()
    await db.refresh(v)  # requested_at comes from the database default
    out = _verification_out(v, issue)
    # a free light recheck settles SEO/AEO/GEO fixes; Speed and Accessibility wait for the next full audit.
    # Over the daily light-check allowance it simply stays queued until the next check or audit.
    if issue.module in LIGHT_MODULES:
        await jobs.enqueue_check(db, site, "verify", kind="verify")
    return out


@router.get("/api/sites/{site_id}/verifications", response_model=list[VerificationOut])
async def verifications(site: Site = Depends(owned_site), db: AsyncSession = Depends(get_session)):
    rows = (await db.execute(
        select(Verification, Issue).join(Issue, Issue.id == Verification.issue_id)
        .where(Verification.site_id == site.id).order_by(Verification.requested_at.desc()).limit(50)
    )).all()
    return [_verification_out(v, issue) for v, issue in rows]


@router.get("/api/sites/{site_id}/status", response_model=StatusOut)
async def status(site: Site = Depends(owned_site), db: AsyncSession = Depends(get_session)):
    pending = list(await db.scalars(select(Job).where(Job.status.in_(("queued", "running")), Job.payload["site_id"].as_integer() == site.id)))
    last = await db.scalar(select(func.max(Audit.created_at)).where(Audit.site_id == site.id))
    return StatusOut(
        running=[j.kind for j in pending if j.status == "running"],
        queued=[j.kind for j in pending if j.status == "queued"],
        last_audit_at=last,
        next_audit_at=site.next_audit_at,
    )


# ---------- deploy webhook (Change Detective) ----------

def _hook_url(token: str) -> str:
    return f"{settings.public_api_url.rstrip('/')}/api/hooks/deploy/{token}"


@router.get("/api/sites/{site_id}/deploy-hook")
async def get_deploy_hook(site: Site = Depends(owned_site)):
    return {"url": _hook_url(site.deploy_token) if site.deploy_token else None}


@router.post("/api/sites/{site_id}/deploy-hook")
async def rotate_deploy_hook(site: Site = Depends(owned_site), db: AsyncSession = Depends(get_session)):
    """Creates the hook, or replaces it (the old URL stops working)."""
    site.deploy_token = secrets.token_urlsafe(24)
    await db.commit()
    return {"url": _hook_url(site.deploy_token)}


@router.delete("/api/sites/{site_id}/deploy-hook", status_code=204)
async def delete_deploy_hook(site: Site = Depends(owned_site), db: AsyncSession = Depends(get_session)):
    site.deploy_token = None
    await db.commit()


@router.post("/api/hooks/deploy/{token}", status_code=202, include_in_schema=False)
async def deploy_hook(token: str, request: Request, db: AsyncSession = Depends(get_session)):
    """Called by CI/CD after a release (no login: the token in the URL is the secret)."""
    await ratelimit.hit(ratelimit.ip_key("deploy-hook", ratelimit.client_ip(request)), 30)  # slows token guessing
    site = await db.scalar(select(Site).where(Site.deploy_token == token)) if len(token) >= 20 else None
    if not site:
        raise HTTPException(404, "Unknown deploy hook.")
    site_id, domain = site.id, site.domain
    # CI can call this on every push: at most one deploy audit per site per hour, so a busy pipeline can't drain credits
    since = datetime.now(timezone.utc) - DEPLOY_COOLDOWN
    recent = await db.scalar(
        select(Job.id).where(Job.payload["site_id"].as_integer() == site_id, Job.payload["trigger"].as_string() == "deploy", Job.created_at > since).limit(1)
    )
    if recent:
        return {"queued": False, "reason": "cooldown", "site": domain}
    try:
        result = await _queue_paid_audit(db, site, "audit", f"deploy:{site_id}:{secrets.token_hex(8)}", "deploy")
        return {**result, "audit": "full", "site": domain}
    except credits.InsufficientCredits:
        await db.rollback()
    site = await db.get(Site, site_id, populate_existing=True)
    job, reason = await jobs.enqueue_check(db, site, "deploy")
    if job:
        db.add(Alert(site_id=site_id, kind="credits", message="A deploy ran a light check instead of a full audit: no audit credits left."))
        await db.commit()
    return {"queued": job is not None, "audit": "light", "reason": reason, "site": domain}


# ---------- alerts inbox ----------

@router.get("/api/alerts", response_model=list[AlertOut])
async def alerts(user: User = Depends(current_user), db: AsyncSession = Depends(get_session), unread: bool = False):
    query = select(Alert, Site.name).join(Site, Site.id == Alert.site_id).where(Site.owner_id == user.id)
    if unread:
        query = query.where(Alert.read.is_(False))
    rows = await db.execute(query.order_by(Alert.created_at.desc()).limit(100))
    return [AlertOut(id=a.id, site_id=a.site_id, site_name=name, kind=a.kind, message=a.message, read=a.read, created_at=a.created_at) for a, name in rows]


@router.post("/api/alerts/read", status_code=204)
async def mark_read(user: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    owned = select(Site.id).where(Site.owner_id == user.id)
    await db.execute(update(Alert).where(Alert.site_id.in_(owned), Alert.read.is_(False)).values(read=True))
    await db.commit()
