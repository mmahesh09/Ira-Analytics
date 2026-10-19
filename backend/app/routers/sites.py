import secrets
from datetime import datetime
from typing import Literal
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import current_user, owned_site
from ..config import settings
from ..credits import lock_user
from ..db import get_session
from ..plans import ENTITLEMENTS, effective_plan
from ..schema import Site, User

router = APIRouter(prefix="/api/sites", tags=["sites"])

Cadence = Literal["off", "daily", "weekly"]


class SiteIn(BaseModel):
    domain: str = Field(min_length=3, max_length=255)
    name: str = Field(default="", max_length=120)


class SitePatch(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    timezone: str | None = Field(default=None, max_length=64)
    audit_cadence: Cadence | None = None  # light checks; never more often than the plan allows
    auto_full_audit: bool | None = None  # one full audit a month, paid with a credit


class SiteOut(BaseModel):
    id: int
    domain: str
    name: str
    timezone: str
    audit_cadence: str
    auto_full_audit: bool
    tracking_key: str
    snippet: str
    created_at: datetime


def clean_domain(raw: str) -> str:
    """'https://www.Example.com/path' -> 'example.com'."""
    value = raw.strip()
    host = urlparse(value if "://" in value else f"https://{value}").hostname or ""
    host = host.lower().removeprefix("www.")
    if "." not in host or len(host) > 253:
        raise HTTPException(422, "Enter a domain like example.com.")
    return host


def _out(site: Site) -> SiteOut:
    snippet = f'<script defer data-site="{site.tracking_key}" src="{settings.public_api_url}/t.js"></script>'
    return SiteOut(
        id=site.id,
        domain=site.domain,
        name=site.name,
        timezone=site.timezone,
        audit_cadence=site.audit_cadence,
        auto_full_audit=site.auto_full_audit,
        tracking_key=site.tracking_key,
        snippet=snippet,
        created_at=site.created_at,
    )


@router.get("", response_model=list[SiteOut])
async def list_sites(user: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    rows = await db.scalars(select(Site).where(Site.owner_id == user.id).order_by(Site.created_at))
    return [_out(s) for s in rows]


@router.post("", response_model=SiteOut, status_code=201)
async def create_site(body: SiteIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_session)):
    domain = clean_domain(body.domain)
    # serialise this user's concurrent creates so the count below can't be raced past the plan limit
    await lock_user(db, user.id, "sites")
    if await db.scalar(select(Site.id).where(Site.owner_id == user.id, Site.domain == domain)):
        raise HTTPException(409, f"You're already tracking {domain}.")
    plan = await effective_plan(db, user.id)
    limit = ENTITLEMENTS[plan].sites
    if (await db.scalar(select(func.count()).select_from(Site).where(Site.owner_id == user.id)) or 0) >= limit:
        raise HTTPException(402, f"Your {plan.title()} plan includes {limit} site{'s' if limit != 1 else ''}. Upgrade in Billing to add more.")
    site = Site(owner_id=user.id, domain=domain, name=body.name.strip() or domain, tracking_key=secrets.token_hex(8))
    db.add(site)
    await db.commit()
    await db.refresh(site)
    return _out(site)


@router.get("/{site_id}", response_model=SiteOut)
async def get_site(site: Site = Depends(owned_site)):
    return _out(site)


@router.patch("/{site_id}", response_model=SiteOut)
async def update_site(body: SitePatch, site: Site = Depends(owned_site), db: AsyncSession = Depends(get_session)):
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(site, field, value.strip() if isinstance(value, str) else value)
    await db.commit()
    await db.refresh(site)
    return _out(site)


@router.delete("/{site_id}", status_code=204)
async def delete_site(site: Site = Depends(owned_site), db: AsyncSession = Depends(get_session)):
    await db.delete(site)
    await db.commit()
