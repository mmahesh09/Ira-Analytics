"""HTTP security regressions: CSRF origin check, body limits, security headers, CORS, rate limits, authorization
(anonymous / other user / owner) on every site route, mass assignment, AI quota races and production config."""

import asyncio
from dataclasses import replace

import httpx
import pytest
from fastapi import HTTPException
from fastapi.routing import APIRoute
from sqlalchemy import func, select

import app.main as main
import app.routers.content as content
from app import ratelimit
from app.config import Settings, settings
from app.page import parse_page
from app.schema import AiRewrite, Site
from tests.conftest import login, make_site, make_user

FRONTEND = "https://rankwise-xi.vercel.app"


def client(cookies: dict | None = None, headers: dict | None = None) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test", cookies=cookies or {}, headers=headers or {})


# ---------- CSRF ----------

@pytest.mark.asyncio
@pytest.mark.parametrize("headers, allowed", [
    ({"Origin": "https://evil.example", "Sec-Fetch-Site": "cross-site"}, False),
    ({"Origin": "null"}, False),  # sandboxed frames and opaque redirects
    ({"Sec-Fetch-Site": "same-site"}, False),  # a sibling subdomain without an allowed Origin
    ({"Origin": FRONTEND, "Sec-Fetch-Site": "cross-site"}, True),  # listed frontend origin
    ({"Sec-Fetch-Site": "same-origin"}, True),  # through the Next.js /api rewrite
    ({}, True),  # not a browser (curl, server-side): not a CSRF vector
])
async def test_cookie_writes_need_a_trusted_origin(db, headers, allowed):
    user = await make_user(db)
    async with client(await login(db, user), headers) as c:
        res = await c.post("/api/alerts/read")
    assert res.status_code == (204 if allowed else 403)


@pytest.mark.asyncio
async def test_reads_and_cookieless_hooks_skip_the_origin_check(db):
    user = await make_user(db)
    evil = {"Origin": "https://evil.example", "Sec-Fetch-Site": "cross-site"}
    async with client(await login(db, user), evil) as c:
        assert (await c.get("/api/me")).status_code == 200
    async with client(headers=evil) as c:  # Razorpay / CI: authenticated by signature or URL token instead
        assert (await c.post("/api/webhooks/razorpay", content=b"{}")).status_code == 400
        assert (await c.post("/api/hooks/deploy/" + "x" * 32)).status_code == 404


# ---------- body size ----------

@pytest.mark.asyncio
async def test_oversized_bodies_are_refused(db):
    async with client() as c:
        declared = await c.post("/api/audit", content=b"x" * (settings.max_body_bytes + 1), headers={"Content-Type": "application/json"})
        assert declared.status_code == 413

        async def chunks():  # no Content-Length: counted while streaming
            for _ in range(settings.max_body_bytes // 65536 + 2):
                yield b"x" * 65536

        streamed = await c.post("/api/webhooks/razorpay", content=chunks())
        assert streamed.status_code == 413


# ---------- headers & CORS ----------

@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/api/health", "/api/does-not-exist", "/api/me"])
async def test_security_headers_on_success_and_error_responses(db, path):  # db: disposes the pooled engine
    async with client() as c:
        res = await c.get(path)
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"
    assert res.headers["content-security-policy"] == "default-src 'none'; frame-ancestors 'none'"
    assert res.headers["referrer-policy"] == "no-referrer"


@pytest.mark.asyncio
async def test_signed_in_responses_are_never_cached(db):
    user = await make_user(db)
    async with client(await login(db, user)) as c:
        assert (await c.get("/api/me")).headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_cors_allows_only_listed_origins_without_credentials(db):
    async with client() as c:
        ok = await c.get("/api/health", headers={"Origin": FRONTEND})
        evil = await c.get("/api/health", headers={"Origin": "https://evil.example"})
        preflight = await c.options("/api/audit", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert ok.headers["access-control-allow-origin"] == FRONTEND
    assert "access-control-allow-credentials" not in ok.headers
    assert "access-control-allow-origin" not in evil.headers
    assert preflight.status_code == 400


# ---------- rate limits ----------

@pytest.mark.asyncio
async def test_per_user_limits_return_429_with_retry_after(db, monkeypatch):
    monkeypatch.setattr("app.auth.settings", replace(settings, user_rate_per_min=5, user_write_rate_per_min=2))
    user = await make_user(db)
    async with client(await login(db, user)) as c:
        reads = [(await c.get("/api/me")).status_code for _ in range(6)]
    assert reads == [200] * 5 + [429]

    other = await make_user(db, "u_test_2")  # limits are per account
    async with client(await login(db, other)) as c:
        writes = [(await c.post("/api/alerts/read")) for _ in range(3)]
    assert [w.status_code for w in writes] == [204, 204, 429]
    assert 0 < int(writes[-1].headers["retry-after"]) <= 60


@pytest.mark.asyncio
async def test_new_sessions_do_not_reset_the_user_limit(db, monkeypatch):
    monkeypatch.setattr("app.auth.settings", replace(settings, user_rate_per_min=3))
    user = await make_user(db)
    codes = []
    for _ in range(4):
        async with client(await login(db, user)) as c:
            codes.append((await c.get("/api/me")).status_code)
    assert codes == [200, 200, 200, 429]


@pytest.mark.asyncio
async def test_deploy_hook_guessing_is_rate_limited(db):
    async with client() as c:
        codes = [(await c.post(f"/api/hooks/deploy/{'g' * 24}{i:08d}")).status_code for i in range(32)]
    assert codes[:30] == [404] * 30 and codes[30:] == [429, 429]


def test_ip_keys_never_hold_the_raw_ip():
    key = ratelimit.ip_key("deploy-hook", "203.0.113.9")
    assert "203.0.113.9" not in key and key.startswith("deploy-hook:")


# ---------- authorization matrix ----------

def _site_routes():
    for route in main.app.routes:
        if isinstance(route, APIRoute) and "{site_id}" in route.path:
            for method in route.methods - {"HEAD"}:
                yield method, route.path


SITE_ROUTES = sorted(_site_routes())


def _url(path: str, site_id: int) -> str:
    return path.replace("{site_id}", str(site_id)).replace("{issue_id}", "1").replace("{audit_id}", "1")


def test_matrix_covers_the_site_routes():
    assert len(SITE_ROUTES) >= 15  # guards against the walk silently matching nothing


@pytest.mark.asyncio
async def test_every_site_route_refuses_anonymous_and_other_users(db):
    owner, intruder = await make_user(db, "u_owner"), await make_user(db, "u_intruder")
    site = await make_site(db, owner)
    owner_cookie, intruder_cookie = await login(db, owner), await login(db, intruder)
    async with client() as anon, client(intruder_cookie) as other, client(owner_cookie) as mine:
        for method, path in SITE_ROUTES:
            url = _url(path, site)
            kwargs = {"json": {"field": "title"}} if method in ("POST", "PATCH") else {}
            assert (await anon.request(method, url, **kwargs)).status_code == 401, (method, path)
            # someone else's site looks like it doesn't exist (no enumeration of ids)
            assert (await other.request(method, url, **kwargs)).status_code == 404, (method, path)
        assert (await mine.get(f"/api/sites/{site}")).status_code == 200
        assert (await other.get("/api/sites")).json() == []
    assert await db.scalar(select(func.count()).select_from(Site).where(Site.id == site)) == 1  # intruder's DELETE did nothing


@pytest.mark.asyncio
async def test_patch_ignores_fields_that_are_not_editable(db):
    owner = await make_user(db)
    site = await make_site(db, owner)
    async with client(await login(db, owner)) as c:
        before = (await c.get(f"/api/sites/{site}")).json()
        res = await c.patch(f"/api/sites/{site}", json={"name": "Mine", "owner_id": "u_attacker", "tracking_key": "chosen", "domain": "evil.example"})
    assert res.status_code == 200
    after = res.json()
    assert after["name"] == "Mine" and after["tracking_key"] == before["tracking_key"] and after["domain"] == before["domain"]
    assert (await db.get(Site, site, populate_existing=True)).owner_id == owner


@pytest.mark.asyncio
async def test_invalid_input_is_rejected_not_crashing(db):
    owner = await make_user(db)
    site = await make_site(db, owner)
    async with client(await login(db, owner)) as c:
        assert (await c.patch(f"/api/sites/{site}", json={"timezone": "Mars/Olympus"})).status_code == 422
        assert (await c.patch(f"/api/sites/{site}", json={"timezone": "Asia/Kolkata"})).status_code == 200
        assert (await c.get(f"/api/sites/{site}/history", params={"limit": -1})).status_code == 422
        assert (await c.get(f"/api/sites/{site}/history", params={"limit": 10_000})).status_code == 422
        assert (await c.patch(f"/api/sites/{site}", json={"audit_cadence": "hourly"})).status_code == 422


# ---------- AI spend ----------

@pytest.fixture
def fake_llm(monkeypatch):
    monkeypatch.setattr(content, "settings", replace(settings, openrouter_api_key="test-key"))
    calls = []

    async def fake_rewrite(url, field, used, limit):
        calls.append(url)
        await asyncio.sleep(0.05)  # long enough for parallel requests to overlap
        return content.RewriteOut(field=field, url=url, current="", ideal=(30, 60), options=[], used=used + 1, limit=limit)

    monkeypatch.setattr(content, "_rewrite", fake_rewrite)
    return calls


@pytest.mark.asyncio
async def test_parallel_rewrites_never_exceed_the_monthly_quota(db, fake_llm):
    owner = await make_user(db)
    site = await make_site(db, owner)
    async with client(await login(db, owner)) as c:
        results = await asyncio.gather(*[c.post(f"/api/sites/{site}/rewrite", json={"field": "title"}) for _ in range(8)])
    assert sorted(r.status_code for r in results) == [200] * 5 + [429] * 3  # free plan: 5 a month
    assert len(fake_llm) == 5
    assert await db.scalar(select(func.count()).select_from(AiRewrite)) == 5


@pytest.mark.asyncio
async def test_failed_rewrites_give_the_slot_back(db, fake_llm, monkeypatch):
    async def failing(*_):
        raise HTTPException(502, "model down")

    monkeypatch.setattr(content, "_rewrite", failing)
    owner = await make_user(db)
    site = await make_site(db, owner)
    async with client(await login(db, owner)) as c:
        assert (await c.post(f"/api/sites/{site}/rewrite", json={"field": "title"})).status_code == 502
    assert await db.scalar(select(func.count()).select_from(AiRewrite)) == 0


# ---------- stored XSS via crawled links ----------

def test_crawled_links_keep_only_http_urls():
    html = """<a href="JavaScript:alert(1)">x</a><a href=" java&#x09;script:alert(1)">y</a><a href="data:text/html,hi">z</a>
              <a href="vbscript:msgbox">v</a><a href="/ok">ok</a><a href="https://other.example/">ext</a>"""
    page = parse_page("https://example.com/", f"<html><body>{html}</body></html>")
    assert page.internal_links == ["https://example.com/ok"]
    assert page.external_links == ["https://other.example/"]


# ---------- production config ----------

def _prod(**overrides) -> Settings:
    good = dict(
        app_env="production", database_url="postgresql+asyncpg://app:pw@db.example/rankwise", preview_salt="s" * 32,
        public_api_url="https://api.example", cors_origins=["https://app.example"], trusted_proxy_hops=1,
    )
    return replace(settings, **{**good, **overrides})


def test_production_settings_fail_closed():
    assert _prod().problems() == []
    assert replace(settings, app_env="development", preview_salt="").problems() == []  # development is never blocked
    for bad in (dict(preview_salt=""), dict(public_api_url="http://api.example"), dict(cors_origins=["http://localhost:3000"]),
                dict(database_url="postgresql+asyncpg://postgres:postgres@localhost:5432/rankwise"), dict(trusted_proxy_hops=0),
                dict(razorpay_key_secret="k", razorpay_webhook_secret="")):
        assert _prod(**bad).problems(), bad
