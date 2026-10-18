# Rankwise API + worker. Multi-arch (amd64 and arm64, e.g. Oracle Cloud Ampere), no vendor lock-in:
# the same image runs on Coolify, a VPS, Fly.io, Railway or Render.
#   docker build -t rankwise-backend backend/
#   ROLE=api (default) serves FastAPI on $PORT; ROLE=worker runs scheduled audits and queued jobs.

# Lighthouse needs a recent Node; take both from the official image
FROM node:22-bookworm-slim AS lighthouse
RUN npm install -g lighthouse@13.5.0 && npm cache clean --force

FROM python:3.13-slim-bookworm

# Debian's Chromium ships for amd64 and arm64 (Google Chrome has no Linux arm64 build)
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-core ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

COPY --from=lighthouse /usr/local/bin/node /usr/local/bin/node
COPY --from=lighthouse /usr/local/lib/node_modules/lighthouse /usr/local/lib/node_modules/lighthouse
RUN ln -s /usr/local/lib/node_modules/lighthouse/cli/index.js /usr/local/bin/lighthouse

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    LIGHTHOUSE_CHROME_PATH=/usr/bin/chromium \
    CHROME_NO_SANDBOX=true \
    PORT=8000

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x docker-entrypoint.sh \
    && useradd --create-home --uid 10001 rankwise \
    && mkdir -p data/shots && chown -R rankwise:rankwise /app/data
USER rankwise

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import os,urllib.request; os.environ.get('ROLE','api')=='worker' or urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8000\")}/api/health', timeout=4)"

ENTRYPOINT ["tini", "--", "./docker-entrypoint.sh"]
