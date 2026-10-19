"""Postgres-backed job queue and the handlers the worker runs.

claim() uses FOR UPDATE SKIP LOCKED, so several workers never take the same job. Failed jobs retry with
backoff (1, 4, 16 minutes) before being marked failed; jobs stuck "running" after a crash are re-queued.

Metering: an "audit" job (full or deep) only runs against a held credit reservation in its payload; the
reservation is captured when the report is stored and released if the job finally fails. "check" and
"verify" jobs are light checks (no credits), capped per day by the plan when they're queued.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from . import credits
from .crawler import crawl_links
from .db import SessionLocal
from .fetcher import AuditError
from .monitoring import measured, record_audit, verify_outcome
from .plans import DEEP_CRAWL_PAGES, ENTITLEMENTS, LINKS_PER_PAGE, effective_plan
from .runner import audit_once
from .schema import Alert, CreditReservation, Issue, Job, LinkCheck, Site, Verification

log = logging.getLogger("rankwise.jobs")
MAX_ATTEMPTS = 3
STALE_AFTER = timedelta(minutes=20)
LIGHT_KINDS = ("check", "verify")


async def pending(db: AsyncSession, kinds: str | tuple[str, ...], site_id: int) -> int | None:
    """Id of a queued or running job of these kinds for the site, if any."""
    kinds = (kinds,) if isinstance(kinds, str) else kinds
    return await db.scalar(
        select(Job.id).where(Job.kind.in_(kinds), Job.status.in_(("queued", "running")), Job.payload["site_id"].as_integer() == site_id).limit(1)
    )


def add(db: AsyncSession, kind: str, payload: dict, run_at: datetime | None = None) -> Job:
    """Adds a job to the caller's transaction (no commit)."""
    job = Job(kind=kind, payload=payload, run_at=run_at or datetime.now(timezone.utc))
    db.add(job)
    return job


async def enqueue(db: AsyncSession, kind: str, payload: dict, run_at: datetime | None = None) -> Job | None:
    """Adds a job unless the same job for the same site is already waiting or running."""
    if await pending(db, kind, payload.get("site_id")):
        return None
    job = add(db, kind, payload, run_at)
    await db.commit()
    return job


async def checks_today(db: AsyncSession, user_id: str) -> int:
    """Light checks (scheduled, manual and "Mark fixed") queued today (UTC) across the user's sites."""
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return await db.scalar(
        select(func.count(Job.id))
        .join(Site, Site.id == Job.payload["site_id"].as_integer())
        .where(Site.owner_id == user_id, Job.kind.in_(LIGHT_KINDS), Job.created_at >= start)
    ) or 0


async def enqueue_check(db: AsyncSession, site: Site, trigger: str, kind: str = "check") -> tuple[Job | None, str | None]:
    """Queues a light check within the plan's daily allowance. Returns (job, None) or (None, reason)."""
    plan = ENTITLEMENTS[await effective_plan(db, site.owner_id)]
    await credits.lock_user(db, site.owner_id, "checks")
    if await pending(db, LIGHT_KINDS, site.id):
        await db.rollback()
        return None, "already_queued"
    if await checks_today(db, site.owner_id) >= plan.daily_checks:
        await db.rollback()
        return None, "daily_limit"
    job = add(db, kind, {"site_id": site.id, "trigger": trigger})
    await db.commit()
    return job, None


async def claim(db: AsyncSession) -> Job | None:
    await db.execute(
        text("UPDATE jobs SET status = 'queued', locked_at = NULL WHERE status = 'running' AND locked_at < :stale"),
        {"stale": datetime.now(timezone.utc) - STALE_AFTER},
    )
    row = (
        await db.execute(
            text(
                """
                UPDATE jobs SET status = 'running', locked_at = now(), attempts = attempts + 1
                WHERE id = (
                  SELECT id FROM jobs WHERE status = 'queued' AND run_at <= now()
                  ORDER BY run_at FOR UPDATE SKIP LOCKED LIMIT 1
                )
                RETURNING id
                """
            )
        )
    ).first()
    await db.commit()
    return await db.get(Job, row.id) if row else None


async def finish(db: AsyncSession, job: Job, error: str | None = None) -> None:
    now = datetime.now(timezone.utc)
    if error is None:
        job.status, job.finished_at, job.error = "done", now, None
    elif job.attempts < MAX_ATTEMPTS:
        job.status, job.locked_at, job.error = "queued", None, error[:2000]
        job.run_at = now + timedelta(minutes=4 ** (job.attempts - 1))
    else:
        job.status, job.finished_at, job.error = "failed", now, error[:2000]
        # no report came out of this audit: give the credits back
        if reservation_id := (job.payload or {}).get("reservation_id"):
            await credits.release(db, reservation_id, f"audit failed: {error}"[:200])
    await db.commit()


# ---------- handlers ----------

async def _settle_verifications(db: AsyncSession, site: Site, report, audit_id: int, light: bool) -> dict:
    """Before-and-After Verification: settles queued "Mark fixed" requests against this audit.

    A light check only settles issues in modules it measured (SEO/AEO/GEO); Speed and Accessibility fixes
    stay queued until the next full audit, which settles everything.
    """
    queued = list(await db.scalars(select(Verification).where(Verification.site_id == site.id, Verification.status == "queued")))
    if not queued:
        return {}
    issues = {i.id: i for i in await db.scalars(select(Issue).where(Issue.id.in_([v.issue_id for v in queued])))}
    data = report.model_dump()
    measured_now = measured(data)
    now = datetime.now(timezone.utc)
    counts = {"fixed": 0, "still_failing": 0, "unmeasured": 0, "waiting": 0}
    for v in queued:
        issue = issues.get(v.issue_id)
        if light and issue and issue.module not in measured_now:
            counts["waiting"] += 1
            continue
        status, check_status, score = verify_outcome(data, issue.module, issue.check_id) if issue else ("unmeasured", None, None)
        v.status, v.check_status, v.after_module = status, check_status, score
        # a light check's overall score is weighted differently, so only a full audit records the "after" overall
        v.after_overall = None if light else report.overall_score
        v.after_audit_id, v.finished_at = audit_id, now
        counts[status] += 1
        if status == "fixed" and issue:
            change = f" Score {v.before_overall} → {v.after_overall}." if v.before_overall is not None and v.after_overall is not None else ""
            db.add(Alert(site_id=site.id, kind="verified", message=f"Verified fixed: {issue.title}.{change}"[:500]))
    return counts


async def handle_check(payload: dict) -> dict:
    """Light check: scheduled monitoring, "Run light check" and "Mark fixed" rechecks. No credits."""
    async with SessionLocal() as db:
        site = await db.get(Site, payload["site_id"])
        if not site:
            return {"skipped": "site deleted"}
        report = await audit_once(f"https://{site.domain}/", mode="light")
        summary = await record_audit(db, site, report, payload.get("trigger", "scheduled"), kind="check", commit=False)
        settled = await _settle_verifications(db, site, report, summary["audit_id"], light=True)
        await db.commit()
        return {**summary, **settled}


async def handle_audit(payload: dict) -> dict:
    """Full or deep audit, paid by the held reservation in the payload."""
    reservation_id = payload.get("reservation_id")
    if not reservation_id:  # queued before credits existed (or not by us): never a free full audit
        return await handle_check({**payload, "trigger": payload.get("trigger", "scheduled")})
    async with SessionLocal() as db:
        reservation = await db.get(CreditReservation, reservation_id)
        if reservation is None or reservation.status != "held" or reservation.site_id != payload.get("site_id"):
            return {"skipped": f"reservation {reservation.status if reservation else 'missing'}"}
        site = await db.get(Site, payload["site_id"])
        if not site:
            await credits.release(db, reservation_id, "site deleted")
            await db.commit()
            return {"skipped": "site deleted"}

        deep = reservation.kind == "deep_audit"
        report = await audit_once(f"https://{site.domain}/")  # AuditError: retried, then refunded by finish()
        summary = await record_audit(db, site, report, payload.get("trigger", "manual"), kind="deep" if deep else "full", commit=False)
        await credits.capture(db, reservation_id, summary["audit_id"])
        settled = await _settle_verifications(db, site, report, summary["audit_id"], light=False)
        # the broken-link crawl is part of a paid audit, sized by the plan (or the deep-audit limit)
        if not await pending(db, "links", site.id):
            pages = DEEP_CRAWL_PAGES if deep else ENTITLEMENTS[await effective_plan(db, site.owner_id)].crawl_pages
            add(db, "links", {"site_id": site.id, "max_pages": pages})
        await db.commit()
        return {**summary, **settled}


async def handle_links(payload: dict) -> dict:
    async with SessionLocal() as db:
        site = await db.get(Site, payload["site_id"])
        if not site:
            return {"skipped": "site deleted"}
        # payloads are written only by this server; jobs queued before credits fall back to the plan's limit
        max_pages = min(int(payload.get("max_pages") or ENTITLEMENTS[await effective_plan(db, site.owner_id)].crawl_pages), DEEP_CRAWL_PAGES)
        pages, results = await crawl_links(f"https://{site.domain}/", max_pages=max_pages, max_links=max_pages * LINKS_PER_PAGE)

        now = datetime.now(timezone.utc)
        existing = {row.url: row for row in await db.scalars(select(LinkCheck).where(LinkCheck.site_id == site.id))}
        newly_broken: list[str] = []
        seen: set[str] = set()
        for r in results:
            seen.add(r.url)
            row = existing.get(r.url)
            if row is None:
                row = LinkCheck(site_id=site.id, url=r.url)
                db.add(row)
            was_ok = row.ok if row.id else True
            row.source_url, row.internal, row.ok, row.status_code, row.error, row.last_checked_at = r.source_url, r.internal, r.ok, r.status_code, r.error, now
            if not r.ok and was_ok:
                row.first_broken_at = now
                newly_broken.append(r.url)
            elif r.ok:
                row.first_broken_at = None
        # links that disappeared from the site no longer need watching
        gone = [url for url in existing if url not in seen]
        if gone:
            await db.execute(delete(LinkCheck).where(LinkCheck.site_id == site.id, LinkCheck.url.in_(gone)))
        if newly_broken:
            sample = ", ".join(newly_broken[:3])
            db.add(Alert(site_id=site.id, kind="broken_links", message=f"{len(newly_broken)} link{'s' if len(newly_broken) > 1 else ''} broke: {sample}"[:500]))
        await db.commit()
        return {"pages": len(pages), "links": len(results), "newly_broken": len(newly_broken)}


HANDLERS = {"audit": handle_audit, "links": handle_links, "check": handle_check, "verify": handle_check}


async def run(job: Job) -> str | None:
    """Runs a claimed job; returns an error message or None."""
    handler = HANDLERS.get(job.kind)
    if not handler:
        return f"unknown job kind {job.kind}"
    try:
        result = await handler(job.payload)
        log.info("job %s %s done: %s", job.id, job.kind, result)
        return None
    except AuditError as exc:
        return str(exc)
    except Exception as exc:  # keep the worker alive; the job retries
        log.exception("job %s %s crashed", job.id, job.kind)
        return f"{exc.__class__.__name__}: {exc}"
