"""Postgres-backed job queue and the handlers the worker runs.

claim() uses FOR UPDATE SKIP LOCKED, so several workers never take the same job. Failed jobs retry with
backoff (1, 4, 16 minutes) before being marked failed; jobs stuck "running" after a crash are re-queued.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from .crawler import crawl_links
from .db import SessionLocal
from .fetcher import AuditError
from .monitoring import record_audit
from .plans import ENTITLEMENTS, effective_plan
from .runner import audit_once
from .schema import Alert, Job, LinkCheck, Site

log = logging.getLogger("rankwise.jobs")
MAX_ATTEMPTS = 3
STALE_AFTER = timedelta(minutes=20)


async def enqueue(db: AsyncSession, kind: str, payload: dict, run_at: datetime | None = None) -> Job | None:
    """Adds a job unless the same job for the same site is already waiting or running."""
    pending = await db.scalar(
        select(Job.id).where(Job.kind == kind, Job.status.in_(("queued", "running")), Job.payload["site_id"].as_integer() == payload.get("site_id")).limit(1)
    )
    if pending:
        return None
    job = Job(kind=kind, payload=payload, run_at=run_at or datetime.now(timezone.utc))
    db.add(job)
    await db.commit()
    return job


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
    await db.commit()


# ---------- handlers ----------

async def handle_audit(payload: dict) -> dict:
    async with SessionLocal() as db:
        site = await db.get(Site, payload["site_id"])
        if not site:
            return {"skipped": "site deleted"}
        report = await audit_once(f"https://{site.domain}/")
        return await record_audit(db, site, report, payload.get("trigger", "scheduled"))


async def handle_links(payload: dict) -> dict:
    async with SessionLocal() as db:
        site = await db.get(Site, payload["site_id"])
        if not site:
            return {"skipped": "site deleted"}
        plan = ENTITLEMENTS[await effective_plan(db, site.owner_id)]
        pages, results = await crawl_links(f"https://{site.domain}/", max_pages=plan.crawl_pages, max_links=plan.crawl_pages * 30)

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


HANDLERS = {"audit": handle_audit, "links": handle_links}


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
