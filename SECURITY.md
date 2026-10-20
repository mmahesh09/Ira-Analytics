# Rankwise security hardening report

Audit and remediation of the Rankwise SEO/AEO/GEO audit platform, October 2026, on branch `security-hardening`.
No production deploys, credential rotations or history rewrites were made. Every result below comes from local tests, a
local production build and a disposable PostgreSQL 18 database.

## 1. Executive summary

The codebase already had a solid base: ownership checks on every site route, a parameterized ORM, HMAC-verified
Razorpay payments with idempotent grants, Postgres-backed preview limits, a non-root container and baseline
headers. The serious gaps were around **outbound requests from headless browsers** (Lighthouse could reach internal
networks), **brute-force protection** (per-IP only, and on Cloudflare the IP keying collapsed into one shared
bucket), **CSRF defence in depth**, **vulnerable dependencies**, and **fail-open production configuration**.

All code-level findings are fixed and covered by automated tests: 142 backend tests, 19 proxy and real-browser tests,
24 runtime checks against a production build, and a browser CSP check with 0 violations. A few items still need
dashboard or host configuration from you (§10). Passing tests do not make the application "secure". They show
that the specific risks listed here are addressed.

## 2. Stack

| Layer | Technology | Hosting |
| --- | --- | --- |
| Frontend | Next.js 16 (App Router), React 19, Tailwind 4 | Vercel and Cloudflare Workers (OpenNext) |
| Auth | Better Auth 1.7 (email + password, sessions in Postgres) | inside the Next.js app |
| API | FastAPI 0.151 / Starlette 1.9, SQLAlchemy 2 async, Alembic | Render (Docker); Coolify/VPS via docker-compose |
| Database | PostgreSQL (Neon) | Neon, us-east-2 |
| Payments | Razorpay subscriptions + orders, signed webhooks | — |
| Outbound | httpx fetcher, Playwright (axe-core), Lighthouse CLI, OpenRouter, PageSpeed | — |
| CI | GitHub Actions | — |

The frontend rewrites `/api/*` to FastAPI, so the Better Auth session cookie stays first-party. FastAPI validates
that cookie against Better Auth's `session` table.

## 3–4. Findings and fixes

Status key: **Fixed + verified** · **Fixed, not fully verified** · **Requires manual action** · **Accepted** (risk taken knowingly).

### High

| # | Finding | Fix | Status | Evidence |
| --- | --- | --- | --- | --- |
| H1 | **Lighthouse SSRF.** The local Lighthouse fallback ran Chrome with unrestricted network access, so an audited page could redirect or load `169.254.169.254`, the database or admin ports. This matters on the Coolify/Oracle route, where `LOCAL_LIGHTHOUSE=true` is the default. | `app/egress.py`: a local egress proxy is the only route out for both headless browsers. Each CONNECT or HTTP request passes the private-network check and dials the vetted IP. QUIC and non-proxied WebRTC are off. | Fixed + verified | `tests/test_egress.py`: a real Chrome reaches a loopback "internal service" without the proxy and makes **0** requests with it. The Lighthouse CLI against loopback makes 0 hits and still scores public sites. |
| H2 | **No per-account brute-force limit.** Only per-IP limits existed, so credential stuffing spread across IPs went unchecked. | A Better Auth hook allows 10 failed sign-ins per email per 15 minutes across all IPs, keyed by a hashed email. Unknown emails behave the same way, so it reveals nothing about which accounts exist. | Fixed + verified | e2e: 10 guesses from 10 IPs, then the right password is still refused (429). Unknown emails lock out identically, and the key is case-insensitive. |
| H3 | **Vulnerable dependencies.** starlette 0.41 (Host-header URL reconstruction, request.url path injection, multipart/Range DoS), lxml 5.3 (XXE), cryptography 44 (bundled OpenSSL, certificate validation), python-dotenv, pytest. | FastAPI 0.115.6 → 0.151.0 (starlette 1.9), lxml 6.1.3, cryptography 50.0.2, python-dotenv 1.2.4, pytest 9.1.1, pytest-asyncio 1.3.0. | Fixed + verified | `pip-audit`: no known vulnerabilities. All 142 tests pass on the new stack. |

### Medium

| # | Finding | Fix | Status | Evidence |
| --- | --- | --- | --- | --- |
| M1 | **Sign-in IP keying.** Better Auth reads `X-Forwarded-For`, which Cloudflare appends to. Any client could force every sign-in into **one shared bucket** of 5/min, locking everyone out. | `advanced.ipAddress.ipAddressHeaders`: `cf-connecting-ip` on Workers and `x-real-ip` on Vercel, both set by the platform. `AUTH_IP_HEADER` overrides. | Fixed, not fully verified | Verified locally with a test header. Detection on the real Vercel and Cloudflare deployments can't be tested from here. |
| M2 | **No CSRF defence beyond SameSite=Lax** on cookie-authenticated writes, including body-less ones like `POST /api/billing/cancel`. | `security.OriginCheck`: writes that carry a session cookie must be `Sec-Fetch-Site: same-origin` or come from a listed Origin. Webhooks are exempt. | Fixed + verified | `test_http_security.py` (6 cases). e2e through the real Next.js rewrite: cross-site 403, same-origin 204. |
| M3 | **AI rewrite quota race.** Parallel requests could exceed the monthly LLM allowance. | The slot is reserved under a per-user advisory lock before the model call, and released on failure. | Fixed + verified | 8 parallel requests on the free plan → exactly 5 succeed and 5 LLM calls are made. A failed call returns its slot. |
| M4 | **No general API rate limit or body cap.** | Per-user limits (300/min overall, 60/min for writes, keyed on the account, not the session) and a per-IP limit on the deploy hook, all counted in Postgres (migration 0003). Bodies over 256 KB → 413, whether declared or streamed. | Fixed + verified | Tests: 429 with `Retry-After`, new sessions don't reset the count, 413 for both declared and chunked bodies. |
| M5 | **Weak CSP.** Only `frame-ancestors` was set. | Full CSP (§9), COOP, `X-Powered-By` off, and a deny-all CSP plus `nosniff`/`no-store` on API responses. | Fixed + verified (Razorpay Checkout not exercised) | Chrome on 12 public and signed-in pages: **0 violations**. Checkout needs live keys, so `CSP_REPORT_ONLY=true` is the fast way back if it's blocked. |
| M6 | **Fail-open production config.** Empty `PREVIEW_SALT`, http URLs, missing webhook secret, public `/docs`. | `APP_ENV=production` refuses to start on unsafe settings, hides the docs, trims `/api/health` and adds HSTS. | Fixed + verified | `test_production_settings_fail_closed`, plus a manual start that lists every problem. |
| M7 | **DNS rebinding in the Playwright guard.** Chrome re-resolved hosts after the guard's check. | Covered by H1: the proxy resolves each host once and connects to that IP. | Fixed + verified | `test_egress.py`: rebinding host and pinned dial. |
| M8 | **The app DB role is the owner,** so an injection could drop or alter tables. | `docs/db-roles.sql`: a DML-only role. Alembic uses `MIGRATION_DATABASE_URL`. | Fixed + verified; **requires manual action** to adopt | The full e2e and CSP run passes with the API, worker and Better Auth connected as the role. DDL, TRUNCATE and `alembic_version` writes are refused. |
| M9 | **No security scanning in CI.** | Security job: gitleaks (full history), pip-audit, bandit (medium+), audit-ci (high). Actions pinned to SHAs, plus Dependabot and a gitleaks pre-commit hook. | Fixed, not fully verified | Each tool passes locally. The workflow itself hasn't run on GitHub yet. |
| M10 | **No password reset, email verification or MFA.** | Reset (30-minute single-use link, revokes other sessions), verification, optional TOTP with backup codes, and an Account & security page (change password, sign out other devices). | Fixed, not fully verified | e2e: TOTP enable → sign-in challenge → no session until verified. Reset and verification emails need a provider (§10). |
| M11 | **Breached passwords accepted.** | Have I Been Pwned check (k-anonymity) on sign-up, password change and reset. Max length 128. | Fixed + verified | e2e: `password123` refused. |

### Low

| # | Finding | Fix | Status |
| --- | --- | --- | --- |
| L1 | NAT64 addresses (`64:ff9b::/96`) count as global but embed private IPv4 addresses. | `fetcher.is_public_ip` checks the embedded address. | Fixed + verified |
| L2 | Crawled `JavaScript:`/`data:` links slipped past a case-sensitive filter (React 19 blocked them at render time). | The crawler keeps only http(s) links, and the link list renders only http(s) URLs as links. | Fixed + verified |
| L3 | `history?limit=-1` → 500, and the site timezone was unvalidated. | Bounded query parameter and an IANA timezone list (`tzdata` pinned for slim images). | Fixed + verified |
| L4 | CORS sent `allow_credentials` although only the anonymous stream is cross-origin. | Credentials off. Origins come from an allowlist. | Fixed + verified |
| L5 | `/api/health` leaked exception class names. | Trimmed in production. | Fixed + verified |
| L6 | `backend/.env` was committed in `4d438fb` and removed in `8e9df6a`. The only non-empty secret was a **localhost** Postgres password. | No rewrite needed. gitleaks finds no leaks across all 36 commits. | Requires manual action (rotate that local password if you reuse it anywhere) |
| L7 | FastAPI ignores the session cookie's HMAC suffix. The token is a 32-character random value, so the signature adds nothing an attacker could exploit. | Not changed. Verifying it would mean copying `BETTER_AUTH_SECRET` into the backend. | Accepted |
| L8 | `GHSA-5j98-mcp5-4vw2`: `glob` CLI command injection, via `@opennextjs/cloudflare`. | Build-time only, and never run on untrusted input. npm's suggested "fix" is a downgrade. Allowlisted in CI by GHSA ID, so any new high still fails. | Accepted (re-check when OpenNext updates) |
| L9 | The frontend `.env.example` was gitignored and listed one variable. | Tracked, with placeholders for every variable. | Fixed |

**Not applicable:** file uploads (there are none). Row-level security: no browser, PostgREST or Data API path reaches the
database (`neon.ts` has `auth: false`), so tenant isolation is enforced in the API and tested on every site route. SQL
injection: no string-built SQL was found, and all `text()` calls use bind parameters.

## 5. Files

New: `backend/app/{security,ratelimit,egress}.py`, `backend/alembic/versions/0003_api_rate.py`,
`backend/tests/{test_fetcher_ssrf,test_http_security,test_egress}.py`, `frontend/src/lib/email.ts`,
`frontend/src/components/{auth-recovery,app/account}.tsx`, the `/forgot-password`, `/reset-password`, `/two-factor` and
`/app/account` pages, `docs/db-roles.sql`, `.github/dependabot.yml`, `.pre-commit-config.yaml`, `frontend/.env.example`.

Changed: `backend/app/{main,config,auth,fetcher,page,schema,performance,accessibility}.py`, the `routers/{sites,content,monitoring}` routers,
`alembic/env.py`, `requirements.txt`, `frontend/next.config.ts`, `frontend/src/lib/{auth,auth-client}.ts`,
`auth-form.tsx`, `app-shell.tsx`, `monitoring.tsx`, `.github/workflows/ci.yml`, `render.yaml`, `docker-compose.yml`, both `.env.example` files.

## 6. Database changes

- **Migration `0003_api_rate`** (additive): one table, `api_rate(key, window_start, count)`, holding request counters and
  sign-in failures (hashed keys only).
- **Better Auth `twoFactor` plugin**: needs `npx auth migrate` (adds a `twoFactor` table and a `user.twoFactorEnabled` column).
- **`docs/db-roles.sql`**: grants only. Nothing is applied until you run it.

## 7–8. Tests and results

| Check | Result |
| --- | --- |
| `pytest` (backend, PG18) | 142 passed (69 at baseline) |
| `alembic upgrade head && alembic check` | clean |
| `tsc --noEmit`, ESLint on `src/` (clean tree) | 0 errors (2 pre-existing warnings) |
| `next build` (clean tree) | success |
| Runtime e2e (`next start` → FastAPI → PG, as the DML-only role) | 24/24 |
| Chrome CSP check, 12 pages | 0 violations |
| pip-audit · bandit (medium+) · audit-ci (high) · gitleaks (36 commits) | clean · clean · clean with one reviewed allowlist entry · no leaks |

Not run: the Docker image build (Docker Desktop wasn't running), the workflow on GitHub, Razorpay Checkout (needs keys),
and anything against production.

## 9. Headers now sent

Pages get a CSP with `default-src 'self'`; scripts limited to self, `'unsafe-inline'`, Razorpay Checkout and PostHog
when configured; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'` plus Razorpay; `frame-ancestors 'none'`;
and `upgrade-insecure-requests`. They also get HSTS (2 years, includeSubDomains), `X-Frame-Options: DENY`, `nosniff`,
`strict-origin-when-cross-origin`, `Permissions-Policy`, and `COOP: same-origin-allow-popups`.
`'unsafe-inline'` stays because cached and partially prerendered pages can't carry a per-request nonce. Removing it
would need dynamic rendering on every page.

API responses get `default-src 'none'`, `nosniff`, `DENY`, `no-referrer`, HSTS in production, and `no-store` when signed in.

## 10. Manual actions, in priority order

1. **Render:** set `APP_ENV=production` (already in `render.yaml`). Confirm `PREVIEW_SALT`, an https `PUBLIC_API_URL`,
   `CORS_ORIGINS` listing **every** frontend origin (Vercel *and* workers.dev, or writes from the missing one get 403) and
   `TRUSTED_PROXY_HOPS=1`. If Razorpay keys are set, `RAZORPAY_WEBHOOK_SECRET` must be too, or the API won't start.
2. **Run Better Auth migrations** for the `twoFactor` table: `cd frontend && npx auth migrate` with the owner's `DATABASE_URL`.
   Do this **before** deploying the frontend, or sign-in fails.
3. **Database role:** create `rankwise_app` and run `docs/db-roles.sql` as the owner. Then point `DATABASE_URL` at it on
   Render, Vercel and Cloudflare, and set `MIGRATION_DATABASE_URL` (owner) on Render.
4. **Email:** set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` and `EMAIL_FROM` (on a verified domain) on Vercel/Cloudflare.
   Until then, the "Forgot password" page says email reset isn't available. Once existing users have verified, set
   `AUTH_REQUIRE_EMAIL_VERIFICATION=true` (this also makes sign-up enumeration-proof).
5. **Spending caps (application limits are not a hard cap):** set a credit limit on the OpenRouter key, enable budget
   alerts in Google Cloud for PageSpeed, set DataForSEO limits, and set Neon compute/storage limits.
6. **GitHub:** enable secret scanning, push protection, Dependabot alerts and security updates. Run `pre-commit install` locally.
7. **Privacy:** the new PostHog code calls `posthog.identify` with users' email and name. Either list PostHog as a
   processor in the privacy policy or drop the email from `identify`.
8. **Lint locally:** `npm run lint` scans `frontend/.open-next/` (build output) and runs out of memory. Delete that
   folder before linting, or add `.open-next/**` to the ESLint ignores (a config-protection hook blocked me from editing it).

## 11. Open items

- Razorpay Checkout under the new CSP: verify with test keys before enforcing it in production.
- The Docker image wasn't rebuilt locally: CI and Render will build it, so watch the first deploy.
- Neither the Vercel nor Cloudflare IP-header detection (M1) was tested on the real platforms.

## 12. Before deploying

Merge `security-hardening`, then do §10 steps 1–3 in order. Deploy the backend first, because migration 0003 must exist
before the frontend's lockout hook writes to `api_rate`. Then deploy the frontend, sign in once on each host, and turn
on 2FA for your own admin account.
