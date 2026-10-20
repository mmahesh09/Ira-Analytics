"""Product feedback: public submissions (validation, idempotency, rate limit) and admin-only reads."""

import csv
import io
import uuid
from dataclasses import replace

import httpx
import pytest
from sqlalchemy import func, select, text

import app.auth as auth_module
import app.main as main
import app.routers.feedback as feedback_router
from app.config import settings
from app.models import FeedbackIn
from app.schema import Feedback
from tests.conftest import login, make_user

ADMIN = "admin@example.test"


def client(cookies: dict | None = None) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test", cookies=cookies or {})


def payload(**overrides) -> dict:
    body = {
        "submission_id": str(uuid.uuid4()),
        "role": "founder",
        "usage_frequency": "weekly",
        "satisfaction_rating": 4,
        "usability_rating": 5,
        "recommendation_score": 9,
        "primary_goal": "ai_visibility",
        "features_used": ["visibility_audit", "scorecard"],
        "most_valuable_feature": "visibility_audit",
        "biggest_challenge": "missing_features",
        "requested_feature": "Slack alerts",
    }
    body.update(overrides)
    return body


@pytest.fixture
def admins(monkeypatch):
    patched = replace(settings, admin_emails=frozenset({ADMIN}))
    monkeypatch.setattr(auth_module, "settings", patched)
    return patched


async def make_admin(db, verified: bool = True) -> dict:
    await db.execute(text('INSERT INTO "user" (id, name, email, "emailVerified") VALUES (\'u_admin\', \'Admin\', :e, :v)'), {"e": ADMIN, "v": verified})
    await db.commit()
    return await login(db, "u_admin")


# ---------- validation (no database) ----------

def test_blank_optional_text_is_stored_as_null():
    body = FeedbackIn(**payload(name="  ", email="", positive_feedback="\n"))
    assert body.name is None and body.email is None and body.positive_feedback is None


@pytest.mark.parametrize("overrides", [
    {"satisfaction_rating": 0}, {"satisfaction_rating": 6}, {"usability_rating": 0}, {"recommendation_score": 11},
    {"recommendation_score": -1}, {"email": "not-an-email"}, {"role": "ceo"}, {"features_used": ["teleport"]},
    {"features_used": ["scorecard", "scorecard"]}, {"features_used": ["none_yet", "scorecard"]},
    {"role": "other"}, {"primary_goal": "other", "primary_goal_other": "   "}, {"biggest_challenge": "other"},
    {"improvement_suggestions": "x" * 2001}, {"is_admin": True},
])
def test_invalid_input_is_refused(overrides):
    with pytest.raises(ValueError):
        FeedbackIn(**payload(**overrides))


@pytest.mark.parametrize("missing", ["role", "usage_frequency", "satisfaction_rating", "usability_rating", "recommendation_score", "primary_goal", "biggest_challenge", "submission_id"])
def test_required_fields(missing):
    body = payload()
    del body[missing]
    with pytest.raises(ValueError):
        FeedbackIn(**body)


def test_other_text_is_kept_only_for_other():
    assert FeedbackIn(**payload(role="other", role_other="Investor")).role_other == "Investor"
    assert FeedbackIn(**payload(role="developer", role_other="left over")).role_other is None


def test_contact_permission_needs_an_email():
    assert FeedbackIn(**payload(contact_permission=True)).contact_permission is False
    assert FeedbackIn(**payload(contact_permission=True, email="a@b.co")).contact_permission is True


def test_csv_cells_cannot_become_formulas():
    assert feedback_router._csv_cell("=HYPERLINK(1)") == "'=HYPERLINK(1)"
    assert feedback_router._csv_cell("@SUM(A1)") == "'@SUM(A1)"
    assert feedback_router._csv_cell(["a", "b"]) == "a; b"
    assert feedback_router._csv_cell(None) == ""


# ---------- submission (real Postgres) ----------

@pytest.mark.asyncio
async def test_submission_is_saved(db):
    async with client() as c:
        r = await c.post("/api/feedback", json=payload(name="Ada", email="ada@example.test", contact_permission=True))
    assert r.status_code == 201
    row = await db.scalar(select(Feedback))
    assert row.name == "Ada" and row.satisfaction_rating == 4 and row.features_used == ["visibility_audit", "scorecard"]
    assert row.contact_permission is True and row.created_at is not None


@pytest.mark.asyncio
async def test_invalid_submission_returns_422_and_saves_nothing(db):
    async with client() as c:
        r = await c.post("/api/feedback", json=payload(satisfaction_rating=9))
    assert r.status_code == 422
    assert await db.scalar(select(func.count()).select_from(Feedback)) == 0


@pytest.mark.asyncio
async def test_duplicate_submission_id_stores_one_row(db):
    body = payload()
    async with client() as c:
        first = await c.post("/api/feedback", json=body)
        second = await c.post("/api/feedback", json=body)
    assert first.status_code == second.status_code == 201
    assert await db.scalar(select(func.count()).select_from(Feedback)) == 1


@pytest.mark.asyncio
async def test_submissions_are_rate_limited_per_ip(db, monkeypatch):
    monkeypatch.setattr(feedback_router, "settings", replace(settings, feedback_per_ip_per_10min=2))
    async with client() as c:
        codes = [(await c.post("/api/feedback", json=payload())).status_code for _ in range(3)]
    assert codes == [201, 201, 429]


# ---------- admin access ----------

ADMIN_ROUTES = ["/api/admin/feedback", "/api/admin/feedback/stats", "/api/admin/feedback/export.csv", "/api/admin/feedback/1"]


@pytest.mark.asyncio
async def test_admin_routes_are_hidden_from_everyone_else(db, admins):
    await make_user(db, "u_regular")
    regular = await login(db, "u_regular")
    unverified = await make_admin(db, verified=False)
    for cookies, expected in ((None, 401), (regular, 404), (unverified, 404)):
        async with client(cookies) as c:
            for path in ADMIN_ROUTES:
                assert (await c.get(path)).status_code == expected, (path, cookies)


@pytest.mark.asyncio
async def test_there_is_no_way_to_change_or_delete_feedback(db, admins):
    cookies = await make_admin(db)
    async with client(cookies) as c:
        await c.post("/api/feedback", json=payload())
        for method in ("PUT", "PATCH", "DELETE"):
            assert (await c.request(method, "/api/admin/feedback/1")).status_code == 405


@pytest.mark.asyncio
async def test_admin_lists_filters_and_exports(db, admins):
    cookies = await make_admin(db)
    async with client(cookies) as c:
        await c.post("/api/feedback", json=payload(role="developer", satisfaction_rating=2, recommendation_score=3, features_used=["cms_publishing"], requested_feature="=cmd|' /C calc'!A0"))
        await c.post("/api/feedback", json=payload(improvement_suggestions="Faster 100%_ audits"))
        await c.post("/api/feedback", json=payload(features_used=[], most_valuable_feature=None, biggest_challenge="no_issues", requested_feature=None))

        listing = (await c.get("/api/admin/feedback", params={"sort": "satisfaction_rating", "order": "asc", "page_size": 2})).json()
        assert listing["total"] == 3 and len(listing["items"]) == 2 and listing["items"][0]["satisfaction_rating"] == 2

        assert (await c.get("/api/admin/feedback", params={"role": "developer"})).json()["total"] == 1
        assert (await c.get("/api/admin/feedback", params={"feature": "scorecard"})).json()["total"] == 1
        assert (await c.get("/api/admin/feedback", params={"feature": "cms_publishing"})).json()["total"] == 1
        assert (await c.get("/api/admin/feedback", params={"min_rating": 4})).json()["total"] == 2
        assert (await c.get("/api/admin/feedback", params={"q": "100%_"})).json()["total"] == 1  # LIKE wildcards are literal
        assert (await c.get("/api/admin/feedback", params={"date_from": "2000-01-01", "date_to": "2000-01-02"})).json()["total"] == 0
        assert (await c.get("/api/admin/feedback", params={"sort": "email"})).status_code == 422

        stats = (await c.get("/api/admin/feedback/stats")).json()
        assert stats["total"] == 3 and stats["avg_satisfaction"] == pytest.approx(10 / 3, abs=0.01)
        assert stats["nps"] == round((2 - 1) * 100 / 3)
        assert stats["feature_requests"] == 2 and sum(d["count"] for d in stats["trend"]) == 3 and len(stats["trend"]) == 30
        assert {"value": "missing_features", "count": 2} in stats["top_challenges"]
        assert {"value": "cms_publishing", "count": 1} in stats["features_used"]

        first_id = listing["items"][0]["id"]
        assert (await c.get(f"/api/admin/feedback/{first_id}")).json()["role"] == "developer"
        assert (await c.get("/api/admin/feedback/999999")).status_code == 404

        export = await c.get("/api/admin/feedback/export.csv", params={"role": "developer"})
    assert export.status_code == 200 and export.headers["content-type"].startswith("text/csv")
    rows = list(csv.reader(io.StringIO(export.text.lstrip("﻿"))))
    assert rows[0][:3] == ["id", "created_at", "name"] and len(rows) == 2
    assert rows[1][rows[0].index("requested_feature")].startswith("'=")


@pytest.mark.asyncio
async def test_me_reports_admin_status(db, admins):
    cookies = await make_admin(db)
    async with client(cookies) as c:
        assert (await c.get("/api/me")).json()["is_admin"] is True
    await make_user(db, "u_regular")
    async with client(await login(db, "u_regular")) as c:
        assert (await c.get("/api/me")).json()["is_admin"] is False
