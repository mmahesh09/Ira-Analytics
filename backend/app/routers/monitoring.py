"""Monitoring API: health history, issues, broken links, audit-now, deploy webhook and the alerts inbox."""

import secrets
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .. import jobs
from ..auth import current_user, owned_site
from ..config import settings
from ..db import get_session
from ..schema import Alert, Audit, Issue, Job, LinkCheck, Site, User

router = APIRouter(tags=["monitoring"])


class AuditPoint(BaseModel):
    id: int
    created_at: datetime
    trigger: str
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

@router.get("/api/sites/{site_id}/history", response_model=list[AuditPoint])
async def history(site: Site = Depends(owned_site), db: AsyncSession = Depends(get_session), limit: int = 90):
    rows = await db.scalars(select(Audit).where(Audit.site_id == site.id).order_by(Audit.created_at.desc()).limit(min(limit, 365)))
    return [AuditPoint(id=a.id, created_at=a.created_at, trigger=a.trigger, overall=a.overall_score, seo=a.seo, aeo=a.aeo, geo=a.geo, speed=a.speed) for a in reversed(list(rows))]


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
    return [IssueOut.model_validate(i, from_attributes=True) for i in await db.scalars(query.order_by(order).limit(500))]


@router.get("/api/sites/{site_id}/links", response_model=list[LinkOut])
async def links(site: Site = Depends(owned_site), db: AsyncSession = Depends(get_session), broken: bool = True):
    query = select(LinkCheck).where(LinkCheck.site_id == site.id)
    if broken:
        query = query.where(LinkCheck.ok.is_(False))
    return [LinkOut.model_validate(r, from_attributes=True) for r in await db.scalars(query.order_by(LinkCheck.first_broken_at.desc().nullslast()).limit(1000))]


# ---------- run now & status ----------

@router.post("/api/sites/{site_id}/audits", status_code=202)
async def audit_now(site: Site = Depends(owned_site), db: AsyncSession = Depends(get_session)):
    queued = await jobs.enqueue(db, "audit", {"site_id": site.id, "trigger": "manual"})
    await jobs.enqueue(db, "links", {"site_id": site.id})
    return {"queued": queued is not None}


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
async def deploy_hook(token: str, db: AsyncSession = Depends(get_session)):
    """Called by CI/CD after a release (no login: the token in the URL is the secret)."""
    site = await db.scalar(select(Site).where(Site.deploy_token == token)) if len(token) >= 20 else None
    if not site:
        raise HTTPException(404, "Unknown deploy hook.")
    queued = await jobs.enqueue(db, "audit", {"site_id": site.id, "trigger": "deploy"})
    await jobs.enqueue(db, "links", {"site_id": site.id})
    return {"queued": queued is not None, "site": site.domain}


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
