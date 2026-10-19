"""Entry point for hosts that start the API from the repository root with `uvicorn main:app`
(e.g. a Render "Python" web service left on its default start command).

The real app is backend/app/main.py. Before importing it, this applies the database migrations the way
backend/docker-entrypoint.sh does. Alembic runs in a subprocess because uvicorn imports this module inside
its event loop. If the database stays unreachable the API still starts, so /api/health can say why.
Set RUN_MIGRATIONS=false to skip the migration step.
"""

import os
import subprocess
import sys
import time
from pathlib import Path

BACKEND = Path(__file__).resolve().parent / "backend"


def _migrate(attempts: int = 4, wait: int = 10) -> None:
    for attempt in range(1, attempts + 1):
        result = subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=BACKEND)
        if result.returncode == 0:
            return
        # the app tables reference Better Auth's "user" table, so `npx auth migrate` must have run once
        print(f"Migrations failed (attempt {attempt}/{attempts}): database unreachable or Better Auth tables missing.", file=sys.stderr, flush=True)
        if attempt < attempts:
            time.sleep(wait)
    print("Starting without migrations; /api/health shows the database status.", file=sys.stderr, flush=True)


if os.getenv("RUN_MIGRATIONS", "true").lower() == "true":
    _migrate()

sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)  # relative paths (alembic.ini, .env, data/) resolve as they do in the container

from app.main import app  # noqa: E402,F401
