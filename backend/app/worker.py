"""Background worker: schedules due audits and runs queued jobs, one at a time.

Run alongside the API:  .venv\\Scripts\\python -m app.worker
One job at a time keeps memory predictable (an audit may launch a local Lighthouse browser).
"""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import or_, select

from . import jobs
from .db import SessionLocal
from .monitoring import next_run
from .plans import ENTITLEMENTS, effective_plan
from .schema import Site

log = logging.getLogger("rankwise.worker")
SCHEDULE_EVERY = 60  # seconds
IDLE_SLEEP = 5


async def schedule_due() -> int:
    """Queues an audit + link check for every site whose next scheduled run has arrived."""
    now = datetime.now(timezone.utc)
    async with SessionLocal() as db:
        due = list(await db.scalars(select(Site).where(Site.audit_cadence != "off", or_(Site.next_audit_at.is_(None), Site.next_audit_at <= now))))
        for site in due:
            plan = ENTITLEMENTS[await effective_plan(db, site.owner_id)]
            await jobs.enqueue(db, "audit", {"site_id": site.id, "trigger": "scheduled"})
            await jobs.enqueue(db, "links", {"site_id": site.id})
            site.next_audit_at = next_run(site.audit_cadence, plan.audit_cadence, now)
        await db.commit()
    return len(due)


async def run_forever() -> None:
    """The job loop. Runs as its own process (ROLE=worker) or inside the API (EMBEDDED_WORKER=true)."""
    log.info("worker started")
    last_schedule = 0.0
    loop = asyncio.get_running_loop()
    while True:
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
