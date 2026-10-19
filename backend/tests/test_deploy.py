"""Single-container deploys (Render free tier): DATABASE_URL normalisation and the embedded job loop."""

import asyncio
from dataclasses import replace

from fastapi.testclient import TestClient

import app.main as main
from app.config import async_db_url


def test_neon_url_becomes_asyncpg_with_ssl():
    url = "postgresql://user:p%40ss@ep-cool-1.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    assert async_db_url(url) == "postgresql+asyncpg://user:p%40ss@ep-cool-1.ap-southeast-1.aws.neon.tech/neondb?ssl=require"


def test_other_url_shapes():
    assert async_db_url("postgres://u:p@h:5432/d") == "postgresql+asyncpg://u:p@h:5432/d"
    assert async_db_url("postgresql+asyncpg://u:p@h/d") == "postgresql+asyncpg://u:p@h/d"
    assert async_db_url("postgresql://u:p@h/d?sslmode=verify-full") == "postgresql+asyncpg://u:p@h/d?ssl=verify-full"
    assert async_db_url("postgresql://u:p@h/d?sslmode=no-verify") == "postgresql+asyncpg://u:p@h/d?ssl=require"
    assert async_db_url("postgresql://u:p@h/d?sslmode=disable") == "postgresql+asyncpg://u:p@h/d"
    assert async_db_url("sqlite:///local.db") == "sqlite:///local.db"


def test_embedded_worker_runs_with_the_app_and_stops_on_shutdown(monkeypatch):
    state = {"started": False, "cancelled": False}

    async def fake_loop():
        state["started"] = True
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            state["cancelled"] = True
            raise

    monkeypatch.setattr(main, "run_forever", fake_loop)
    monkeypatch.setattr(main, "settings", replace(main.settings, embedded_worker=True))
    with TestClient(main.app):
        assert state["started"]
    assert state["cancelled"]


def test_no_embedded_worker_by_default(monkeypatch):
    called = []

    async def fake_loop():
        called.append(True)

    monkeypatch.setattr(main, "run_forever", fake_loop)
    monkeypatch.setattr(main, "settings", replace(main.settings, embedded_worker=False))
    with TestClient(main.app):
        pass
    assert not called
