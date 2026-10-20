"""Database fixtures for tests that need real Postgres (locks, SKIP LOCKED, ON CONFLICT).

Point TEST_DATABASE_URL at a disposable, already-migrated database (alembic upgrade head), e.g. the local
container from DEPLOY.md. Tests that use these fixtures are skipped without it, and refuse any host other
than localhost so they can never touch a real database.
"""

import os
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "")
if TEST_DATABASE_URL and urlparse(TEST_DATABASE_URL).hostname in ("localhost", "127.0.0.1"):
    # the app's own engine (request handlers, job handlers) must use the test database too; set before any
    # app import, and load_dotenv() never overrides a variable that is already set
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from app.config import async_db_url  # noqa: E402
TABLES = "feedback, api_rate, credit_ledger, credit_reservations, credit_grants, credit_orders, payments, preview_usage, jobs, audits, sites, subscriptions, billing_events"


@pytest_asyncio.fixture
async def session_factory():
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL not set")
    if urlparse(TEST_DATABASE_URL).hostname not in ("localhost", "127.0.0.1"):
        pytest.fail("TEST_DATABASE_URL must point at a local, disposable database")
    engine = create_async_engine(async_db_url(TEST_DATABASE_URL), pool_size=30, max_overflow=10)
    async with engine.begin() as conn:
        await conn.execute(text(f'TRUNCATE {TABLES}, "user" RESTART IDENTITY CASCADE'))
    yield async_sessionmaker(engine, expire_on_commit=False)
    await engine.dispose()
    from app.db import engine as app_engine

    await app_engine.dispose()  # its pooled connections belong to this test's event loop


@pytest_asyncio.fixture
async def db(session_factory):
    async with session_factory() as session:
        yield session


async def make_user(db, user_id: str = "u_test_1") -> str:
    await db.execute(text('INSERT INTO "user" (id, name, email) VALUES (:id, :id, :email)'), {"id": user_id, "email": f"{user_id}@example.test"})
    await db.commit()
    return user_id


async def login(db, user_id: str) -> dict[str, str]:
    """A Better Auth session row for the user; returns the cookie a signed-in browser would send."""
    token = secrets.token_urlsafe(24)
    await db.execute(
        text('INSERT INTO session (id, "expiresAt", token, "userId") VALUES (:id, :exp, :token, :uid)'),
        {"id": secrets.token_hex(8), "exp": datetime.now(timezone.utc) + timedelta(days=1), "token": token, "uid": user_id},
    )
    await db.commit()
    return {"better-auth.session_token": f"{token}.signature"}


async def make_site(db, user_id: str, domain: str = "example.com") -> int:
    site_id = await db.scalar(
        text("INSERT INTO sites (owner_id, domain, name, tracking_key, timezone, audit_cadence) VALUES (:o, :d, :d, :k, 'UTC', 'weekly') RETURNING id"),
        {"o": user_id, "d": domain, "k": secrets.token_hex(8)},
    )
    await db.commit()
    return site_id
