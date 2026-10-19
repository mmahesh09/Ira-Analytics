#!/bin/sh
# Container entrypoint: apply database migrations, then run the API or the worker (ROLE=api|worker).
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  tries=0
  until alembic upgrade head; do
    tries=$((tries + 1))
    if [ "$tries" -ge 20 ]; then
      echo "Migrations still failing after $tries attempts; giving up." >&2
      exit 1
    fi
    # the app tables reference Better Auth's "user" table, so `npx auth migrate` must have run once
    echo "Migration failed: database not ready yet, or Better Auth tables missing. Retrying in 15s..." >&2
    sleep 15
  done
fi

case "${ROLE:-api}" in
  worker)
    exec python -m app.worker
    ;;
  api)
    exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips="*"
    ;;
  *)
    echo "Unknown ROLE '$ROLE' (use api or worker)" >&2
    exit 1
    ;;
esac
