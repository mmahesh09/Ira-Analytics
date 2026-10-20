"""Background worker: schedules due audits and runs queued jobs, one at a time.

Run alongside the API:  .venv\\Scripts\\python -m app.worker
One job at a time keeps memory predictable (an audit may launch a local Lighthouse browser).
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_, select

from . import credits, jobs
from .db import SessionLocal
from .monitoring import next_run
from .plans import ENTITLEMENTS, effective_plan
from . import sheets
from .retention import prune_old_data
from .schema import Alert, Audit, Site

log = logging.getLogger("rankwise.worker")
SCHEDULE_EVERY = 60  # seconds
IDLE_SLEEP = 5
AUTO_FULL_EVERY = timedelta(days=28)
PRUNE_EVERY = 24 * 60 * 60  # seconds; also runs once at start-up
SHEETS_EVERY = 5 * 60  # seconds: retry feedback rows the API could not copy to the Google Sheet


async def _monthly_full_audit(db, site: Site, now: datetime) -> None:
    """Opt-in (site.auto_full_audit): one full audit a month, paid with a credit, never more."""
    last_full = await db.scalar(select(func.max(Audit.created_at)).where(Audit.site_id == site.id, Audit.kind.in_(("full", "deep"))))
    if last_full and now - last_full < AUTO_FULL_EVERY or await jobs.pending(db, "audit", site.id):
        return
    site_id, owner_id = site.id, site.owner_id
    try:
        reservation = await credits.reserve(db, owner_id, "audit", f"auto:{site_id}:{now:%Y-%m}", site_id)
    except credits.InsufficientCredits:
        await db.rollback()
        recent = await db.scalar(select(Alert.id).where(Alert.site_id == site_id, Alert.kind == "credits", Alert.created_at > now - timedelta(days=7)).limit(1))
        if not recent:
            db.add(Alert(site_id=site_id, kind="credits", message="Your monthly full audit was skipped: no audit credits left. Light checks keep running."))
            await db.commit()
        return
    if reservation.status == "held":
        jobs.add(db, "audit", {"site_id": site_id, "trigger": "scheduled", "reservation_id": reservation.id})
    await db.commit()


async def schedule_due() -> int:
    """Light checks for every site whose next scheduled run has arrived (no credits, capped per day by the
    plan), plus the opt-in monthly full audit. Scheduled monitoring never spends credits on its own."""
    now = datetime.now(timezone.utc)
    async with SessionLocal() as db:
        await credits.sweep_stale_reservations(db)
        await db.commit()
        due = list(await db.scalars(select(Site.id).where(Site.audit_cadence != "off", or_(Site.next_audit_at.is_(None), Site.next_audit_at <= now))))
        for site_id in due:
            # the helpers commit or roll back (which expires loaded rows), so reload the site each time
            site = await db.get(Site, site_id, populate_existing=True)
            if site is None:
                continue
            plan = ENTITLEMENTS[await effective_plan(db, site.owner_id)]
            _, skipped = await jobs.enqueue_check(db, site, "scheduled")
            if skipped == "daily_limit":
                log.info("site %s: daily light-check limit reached", site_id)
            site = await db.get(Site, site_id, populate_existing=True)
            if site.auto_full_audit:
                await _monthly_full_audit(db, site, now)
                site = await db.get(Site, site_id, populate_existing=True)
            site.next_audit_at = next_run(site.audit_cadence, plan.check_cadence, now)
            await db.commit()
    return len(due)


async def run_forever() -> None:
    """The job loop. Runs as its own process (ROLE=worker) or inside the API (EMBEDDED_WORKER=true)."""
    log.info("worker started")
    last_schedule = 0.0
    last_sheets = -float(SHEETS_EVERY)
    last_prune = -float(PRUNE_EVERY)  # loop.time() counts from boot, so this makes the first pass run at start-up
    loop = asyncio.get_running_loop()
    while True:
        if loop.time() - last_prune >= PRUNE_EVERY:
            try:
                async with SessionLocal() as db:
                    removed = await prune_old_data(db)
                if any(removed.values()):
                    log.info("pruned old data: %s", removed)
            except Exception:
                log.exception("pruning failed")
            last_prune = loop.time()

        if sheets.enabled() and loop.time() - last_sheets >= SHEETS_EVERY:
            if count := await sheets.sync_pending():  # never raises
                log.info("copied %d feedback row(s) to the Google Sheet", count)
            last_sheets = loop.time()

        if loop.time() - last_schedule >= SCHEDULE_EVERY:
            try:
                if count := await schedule_due():
                    log.info("scheduled %d site(s)", count)
            except Exception:
                log.exception("scheduling failed")
            last_schedule = loop.time()

        try:
            async with SessionLocal() as db:
                job = await jobs.claim(db)
                if job is None:
                    await asyncio.sleep(IDLE_SLEEP)
                    continue
                log.info("running job %s (%s, attempt %d)", job.id, job.kind, job.attempts)
                error = await jobs.run(job)
                await jobs.finish(db, job, error)
        except asyncio.CancelledError:
            raise
        except Exception:  # e.g. the database is briefly unreachable: back off instead of dying
            log.exception("worker loop error")
            await asyncio.sleep(IDLE_SLEEP * 6)


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    await run_forever()


if __name__ == "__main__":
    asyncio.run(main())
