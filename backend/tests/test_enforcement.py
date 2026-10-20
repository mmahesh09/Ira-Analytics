"""Credit and plan enforcement on every path that can start an audit: API, deploy hook, jobs, scheduler,
anonymous preview. Runs against the local test database; audits are faked, so nothing touches the network."""

import asyncio
from datetime import datetime, timezone

import httpx
import pytest
from sqlalchemy import func, select

import app.jobs as jobs
import app.main as main
from app import credits, ratelimit, worker
from app.config import settings
from app.models import AuditReport
from app.schema import Alert, Audit, CreditReservation, Job, Site
from tests.conftest import login, make_site, make_user

pytestmark = pytest.mark.asyncio


def fake_report(domain: str = "example.com", mode: str = "full") -> AuditReport:
    return AuditReport(url=f"https://{domain}/", final_url=f"https://{domain}/", domain=domain,
                       fetched_at=datetime.now(timezone.utc).isoformat(), overall_score=80, modules={}, mode=mode)


@pytest.fixture
def audits(monkeypatch):
    """Replaces the real audit with a fake one and records which mode each run used."""
    modes: list[str] = []

    async def fake_audit_once(url: str, mode: str = "full"):
        modes.append(mode)
        return fake_report(mode=mode)

    monkeypatch.setattr(jobs, "audit_once", fake_audit_once)
    return modes


def client(cookies: dict | None = None, headers: dict | None = None) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test", cookies=cookies or {}, headers=headers or {})


async def _jobs(db, kind: str) -> list[Job]:
    return list(await db.scalars(select(Job).where(Job.kind == kind).order_by(Job.id).execution_options(populate_existing=True)))


async def test_full_audit_reserves_then_captures_and_queues_the_crawl(db, audits):
    user = await make_user(db)
    site = await make_site(db, user)
    async with client(await login(db, user)) as c:
        res = await c.post(f"/api/sites/{site}/audits")
        assert res.status_code == 202 and res.json() == {"queued": True, "credits_charged": 1, "credits_left": 0}
        again = await c.post(f"/api/sites/{site}/audits")  # still queued: no second charge
        assert again.json() == {"queued": False, "reason": "already_queued"}

        [job] = await _jobs(db, "audit")
        assert await jobs.handle_audit(job.payload)
        reservation = await db.get(CreditReservation, job.payload["reservation_id"], populate_existing=True)
        assert reservation.status == "captured" and reservation.audit_id
        assert audits == ["full"]
        assert (await db.get(Audit, reservation.audit_id)).kind == "full"
        [links] = await _jobs(db, "links")
        assert links.payload["max_pages"] == 10  # Free plan crawl limit

        job.status = "done"
        await db.commit()
        broke = await c.post(f"/api/sites/{site}/audits")
        assert broke.status_code == 402 and "credit" in broke.json()["detail"]


async def test_idempotency_key_is_never_charged_twice(db, audits):
    user = await make_user(db)
    site = await make_site(db, user)
    await credits.grant(db, user, "adjustment", 5, "adj:idem", expires_at=None)
    await db.commit()
    async with client(await login(db, user), {"Idempotency-Key": "click-1"}) as c:
        first = await c.post(f"/api/sites/{site}/audits")
        [job] = await _jobs(db, "audit")
        await jobs.handle_audit(job.payload)
        job.status = "done"
        await db.commit()
        replay = await c.post(f"/api/sites/{site}/audits")
    assert first.json()["queued"] and replay.json() == {"queued": False, "reason": "already_captured"}
    assert (await credits.balance(db, user)).total == 5


async def test_deep_audit_needs_business_or_scale(db):
    user = await make_user(db)
    site = await make_site(db, user)
    async with client(await login(db, user)) as c:
        res = await c.post(f"/api/sites/{site}/audits", json={"deep": True})
    assert res.status_code == 403
    assert await db.scalar(select(func.count()).select_from(CreditReservation)) == 0


async def test_final_failure_refunds_the_credit(db):
    user = await make_user(db)
    site = await make_site(db, user)
    async with client(await login(db, user)) as c:
        await c.post(f"/api/sites/{site}/audits")
    [job] = await _jobs(db, "audit")
    job.attempts = jobs.MAX_ATTEMPTS
    await jobs.finish(db, job, "The site didn't respond.")
    reservation = await db.get(CreditReservation, job.payload["reservation_id"], populate_existing=True)
    assert job.status == "failed" and reservation.status == "released"
    assert (await credits.balance(db, user)).total == 1


async def test_audit_jobs_without_a_valid_reservation_never_run_a_full_audit(db, audits):
    user = await make_user(db)
    site = await make_site(db, user)
    other_site = await make_site(db, user, "other.example")
    # a job queued before credits existed, or written by hand: runs as a light check, costs nothing
    await jobs.handle_audit({"site_id": site, "trigger": "scheduled"})
    assert audits == ["light"]
    # a real reservation, replayed against a different site: refused, nothing runs
    r = await credits.reserve(db, user, "audit", "job:x", site)
    await db.commit()
    assert await jobs.handle_audit({"site_id": other_site, "reservation_id": r.id}) == {"skipped": "reservation held"}
    assert audits == ["light"]
    assert list(await db.scalars(select(Audit.kind))) == ["check"]


async def test_light_checks_are_free_but_capped_per_day(db, audits):
    user = await make_user(db)
    site = await make_site(db, user)
    async with client(await login(db, user)) as c:
        for _ in range(3):  # Free: 3 light checks a day
            assert (await c.post(f"/api/sites/{site}/check")).json() == {"queued": True}
            for job in await _jobs(db, "check"):
                job.status = "done"
            await db.commit()
        assert (await c.post(f"/api/sites/{site}/check")).status_code == 429
    assert await db.scalar(select(func.count()).select_from(CreditReservation)) == 0


async def test_deploy_hook_cooldown_and_light_fallback(db, audits):
    user = await make_user(db)
    site_id = await make_site(db, user)
    site = await db.get(Site, site_id)
    site.deploy_token = "t" * 32
    await db.commit()
    async with client() as c:
        first = (await c.post(f"/api/hooks/deploy/{'t' * 32}")).json()
        assert first["queued"] and first["audit"] == "full"
        assert (await c.post(f"/api/hooks/deploy/{'t' * 32}")).json()["reason"] == "cooldown"
        # out of credits and past the cooldown: a light check instead, plus an alert
        for job in await _jobs(db, "audit"):
            job.created_at = datetime(2020, 1, 1, tzinfo=timezone.utc)
            job.status = "done"
        await db.commit()
        fallback = (await c.post(f"/api/hooks/deploy/{'t' * 32}")).json()
    assert fallback["audit"] == "light" and fallback["queued"]
    assert await db.scalar(select(func.count()).select_from(Alert).where(Alert.kind == "credits")) == 1


async def test_other_users_sites_and_reports_are_invisible(db, audits):
    owner, intruder = await make_user(db, "u_owner"), await make_user(db, "u_intruder")
    site = await make_site(db, owner)
    async with client(await login(db, owner)) as c:
        await c.post(f"/api/sites/{site}/audits")
    [job] = await _jobs(db, "audit")
    summary = await jobs.handle_audit(job.payload)
    before = (await credits.balance(db, owner)).total

    async with client(await login(db, intruder)) as c:
        for method, path in [("post", f"/api/sites/{site}/audits"), ("post", f"/api/sites/{site}/check"),
                             ("get", f"/api/sites/{site}/audits/{summary['audit_id']}"), ("get", f"/api/sites/{site}/history")]:
            assert (await getattr(c, method)(path)).status_code == 404
    async with client() as c:
        assert (await c.post(f"/api/sites/{site}/audits")).status_code == 401
    async with client(await login(db, owner)) as c:  # opening a stored report is free
        assert (await c.get(f"/api/sites/{site}/audits/{summary['audit_id']}")).status_code == 200
    assert (await credits.balance(db, owner)).total == before


async def test_billing_shows_credits_usage_and_light_checks(db, audits):
    user = await make_user(db)
    site = await make_site(db, user)
    async with client(await login(db, user)) as c:
        fresh = (await c.get("/api/billing")).json()
        assert fresh["plan"] == "free" and fresh["credits"]["total"] == 1 and fresh["credits"]["monthly"] == 1
        assert fresh["usage"] == [] and fresh["checks_today"] == 0 and fresh["entitlements"]["monthly_credits"] == 1

        await c.post(f"/api/sites/{site}/audits")
        [job] = await _jobs(db, "audit")
        await jobs.handle_audit(job.payload)
        await c.post(f"/api/sites/{site}/check")
        after = (await c.get("/api/billing")).json()
    assert after["credits"]["total"] == 0 and after["checks_today"] == 1
    assert [(u["site"], u["kind"], u["cost"], u["status"]) for u in after["usage"]] == [("example.com", "audit", 1, "captured")]


async def test_parallel_site_creation_respects_the_plan_limit(db):
    user = await make_user(db)
    cookies = await login(db, user)

    async def create(i: int) -> int:
        async with client(cookies) as c:
            return (await c.post("/api/sites", json={"domain": f"site{i}.example"})).status_code

    codes = await asyncio.gather(*(create(i) for i in range(6)))
    assert sorted(codes) == [201] + [402] * 5  # Free: 1 website
    assert await db.scalar(select(func.count()).select_from(Site)) == 1


async def test_scheduler_runs_light_checks_and_one_paid_monthly_audit(db):
    user = await make_user(db)
    site_id = await make_site(db, user)
    assert await worker.schedule_due() == 1
    assert [j.kind for j in await db.scalars(select(Job))] == ["check"]
    assert await db.scalar(select(func.count()).select_from(CreditReservation)) == 0

    site = await db.get(Site, site_id, populate_existing=True)
    site.auto_full_audit, site.next_audit_at = True, None
    await db.commit()
    await worker.schedule_due()
    reservations = list(await db.scalars(select(CreditReservation)))
    assert len(reservations) == 1 and reservations[0].key.startswith(f"auto:{site_id}:")


async def test_anonymous_preview_is_light_capped_and_ignores_spoofed_ips(db, monkeypatch):
    modes: list[str] = []

    async def fake_run_audit(url, use_cache=True, mode="full"):
        modes.append(mode)
        yield {"type": "result", "report": fake_report(mode=mode).model_dump()}

    monkeypatch.setattr(main, "run_audit", fake_run_audit)
    patched = settings.__class__(**{**settings.__dict__, "trusted_proxy_hops": 0})
    monkeypatch.setattr(main, "settings", patched)
    monkeypatch.setattr(ratelimit, "settings", patched)  # client_ip() lives there
    async with client() as c:
        statuses = [(await c.post("/api/audit", json={"url": "example.com"}, headers={"X-Forwarded-For": f"10.0.0.{i}"})).status_code for i in range(3)]
    assert statuses == [200, 200, 429]  # a forged header doesn't buy more previews
    assert modes == ["light", "light"]

    patched = settings.__class__(**{**settings.__dict__, "trusted_proxy_hops": 1})
    monkeypatch.setattr(main, "settings", patched)
    monkeypatch.setattr(ratelimit, "settings", patched)  # client_ip() lives there
    async with client() as c:
        # behind one trusted proxy, the client can prepend anything, but the proxy's own entry is what counts
        spoofed = [(await c.post("/api/audit", json={"url": "example.com"}, headers={"X-Forwarded-For": f"1.1.1.{i}, 203.0.113.9"})).status_code for i in range(3)]
    assert spoofed == [200, 200, 429]
