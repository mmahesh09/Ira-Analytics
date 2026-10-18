# Deploying Rankwise for free (Oracle Cloud Free VM + Coolify)

Everything here is open source or free-forever. When paying users arrive, the same Docker image and
`docker-compose.yml` move unchanged to any paid host (Hetzner, Fly.io, Railway, Render…).

```
Vercel (free)            Oracle Cloud Always Free VM (4 ARM cores, 24 GB) running Coolify
Next.js frontend  ─────▶ api      FastAPI + Chromium + Lighthouse   (docker-compose.yml, ROLE=api)
Better Auth       ─┐     worker   scheduled audits, crawls, alerts  (ROLE=worker)
                   └───▶ PostgreSQL 18 (Coolify database, public with SSL so Vercel can sign people in)
```

Never paste passwords or keys into chat or commit them: they go only into Coolify's and Vercel's
environment-variable screens.

---

## 1. Create the free VM (Oracle Cloud)

1. Sign up at <https://signup.cloud.oracle.com>. A card is asked for identity only; Always Free shapes are never charged.
   Pick a home region close to your users (e.g. India West (Mumbai)).
2. **Compute → Instances → Create instance**
   - Image: **Canonical Ubuntu 24.04**
   - Shape: **Ampere → VM.Standard.A1.Flex**, **4 OCPU, 24 GB memory** (the Always Free limit)
   - Networking: keep "Assign a public IPv4 address" on
   - SSH keys: "Generate a key pair" and **download the private key**
   - Boot volume: 100 GB is still free (up to 200 GB total)
   - If it says *out of capacity*, try another availability domain or retry later. If it never works, use the
     fallback at the end of this file.
3. Open the web ports in Oracle's firewall: **Instance → Subnet → Default Security List → Add Ingress Rules**,
   source `0.0.0.0/0`, TCP, destination ports **80, 443, 8000, 6001, 6002, 5432**
   (8000/6001/6002 are Coolify's dashboard; 5432 is Postgres for Vercel; you can close 8000 once a domain is set up).
4. Ubuntu images on Oracle also block ports inside the VM. SSH in and open them:
   ```bash
   ssh -i ~/Downloads/ssh-key.key ubuntu@<VM_PUBLIC_IP>
   sudo iptables -I INPUT 6 -p tcp -m multiport --dports 80,443,8000,6001,6002,5432 -j ACCEPT
   sudo netfilter-persistent save
   ```

## 2. Install Coolify (open-source, self-hosted PaaS)

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```
Open `http://<VM_PUBLIC_IP>:8000`, create the admin account immediately (the first visitor becomes admin),
then **Sources → GitHub App → install** it on the `Ira-Analytics` repository.

## 3. Database (Coolify → New Resource → PostgreSQL 18)

1. Create it, then in its settings:
   - **Make it publicly available**: on, public port **5432**
   - **Enable SSL**: on
   - Keep the generated strong password.
2. Copy two connection strings from the resource page:
   - **internal URL** (for the backend, same server)
   - **public URL** (for Vercel)

## 4. Backend (Coolify → New Resource → Docker Compose → from GitHub)

- Repository `Ira-Analytics`, branch `main`, compose file `/docker-compose.yml`.
- Turn on **Connect to predefined network** so the stack can reach the database by its internal host name.
- **Domain** for the `api` service: your domain, e.g. `https://api.yourdomain.com` (DNS A record → VM IP), or
  Coolify's free `sslip.io` address. HTTPS is issued automatically.
- **Environment variables**:

| Name | Value |
|---|---|
| `DATABASE_URL` | internal URL with the async driver: `postgresql+asyncpg://postgres:<password>@<internal-host>:5432/postgres` |
| `CORS_ORIGINS` | `https://rankwise-xi.vercel.app` (plus your custom frontend domain if any, comma-separated) |
| `PUBLIC_API_URL` | the api domain, e.g. `https://api.yourdomain.com` |
| `OPENROUTER_API_KEY` | from <https://openrouter.ai/keys> (AI visibility + AI rewrites) |
| `PAGESPEED_API_KEY` | optional, Google PageSpeed Insights API key |

Do **not** deploy yet: the app tables reference Better Auth's `user` table, so do step 5 first.
(If you deploy early, the api container simply retries its migration every 15 s.)

## 5. Create the sign-in tables (once, from this laptop)

From the repo root on your PC, with the database's **public** URL (PowerShell):
```powershell
cd frontend
$env:DATABASE_URL = Read-Host "Public Postgres URL (postgres://...?sslmode=no-verify)" -MaskInput
npx -y auth@1.7.10 migrate --config src/lib/auth.ts --yes
Remove-Item Env:DATABASE_URL
```
Then press **Deploy** in Coolify. The api container runs `alembic upgrade head`, which creates every other
table, and starts. Check `https://<api-domain>/api/health`: it should report the database as ok.

## 6. Frontend (Vercel → Project → Settings → Environment Variables, Production)

| Name | Value |
|---|---|
| `DATABASE_URL` | the **public** Postgres URL, ending `?sslmode=no-verify` (encrypted; Coolify's certificate is self-signed) |
| `BETTER_AUTH_SECRET` | a new random secret: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `https://rankwise-xi.vercel.app` |
| `BACKEND_URL` | the api domain |
| `NEXT_PUBLIC_API_URL` | the api domain (the live audit stream connects to it directly) |

Redeploy. With the GitHub link working, every `git push` redeploys automatically.

## 7. Check it end to end

- Sign up on the live site, add a site, run an audit: every module returns, including Speed and Accessibility.
- In the report: priority chips, "Biggest wins", code snippets, and **Rewrite with AI**.
- Coolify → worker logs show `scheduled N site(s)` within a minute of adding a site.

## Local run (same stack)

```bash
# put values in a .env file next to docker-compose.yml (never commit it)
docker compose --profile bundled-db up -d --build
```

## Fallback: Hugging Face Spaces + Neon (if Oracle has no capacity)

- Database: a free Postgres at <https://neon.tech> (SSL included).
- Backend: a **Docker** Space built from `backend/Dockerfile`, with the same variables as step 4 and `PORT=7860`.
  Free Spaces sleep when idle and have no separate worker, so scheduled monitoring only runs while it's awake.
