# Deploying Rankwise

Three free options. All use the same Docker image (`backend/Dockerfile`), so moving later is painless.

- **Hugging Face Spaces + Neon**: free, no credit card, every feature on. Recommended.
- **Render (free) + Neon**: no card, but 512 MB, so browser checks are off.
- **Oracle Cloud Free VM + Coolify**: fully open source and powerful, but Oracle asks for a card.

Never paste passwords or keys into chat or commit them: they go only into the host's, Neon's and Vercel's settings screens.

---

## Hugging Face Spaces + Neon (free, no credit card) - recommended

Free CPU Space: 2 vCPU and 16 GB RAM, so every module works, including Speed (local Lighthouse),
Accessibility and Visual Doctor. It sleeps after about 48 hours without visits (step 6 keeps it awake).
The `backend/` folder is the Space: its `README.md` declares `sdk: docker` and `app_port: 8000`.

### 1. Database: Neon (free, no card)
<https://neon.tech> -> sign in with GitHub -> new project `rankwise`, region **AWS US East** (closest to
Hugging Face). Copy the connection string `postgresql://...neon.tech/neondb?sslmode=require`.

### 2. Create the sign-in tables (once, from this PC)
```powershell
cd frontend
$env:DATABASE_URL = Read-Host "Neon connection string" -MaskInput
npx -y auth@1.7.10 migrate --config src/lib/auth.ts --yes
Remove-Item Env:DATABASE_URL
```

### 3. Hugging Face account and token (free, no card)
Sign up at <https://huggingface.co/join>, then **Settings -> Access Tokens -> Create new token**, type **Write**.
Log in on this PC (the token is typed into a hidden prompt, never into chat):
```powershell
uvx --from huggingface_hub hf auth login
```

### 4. Create the Space and upload the backend
```powershell
uvx --from huggingface_hub hf repos create rankwise-api --repo-type space --space-sdk docker
uvx --from huggingface_hub hf upload <your-username>/rankwise-api backend . --repo-type space --exclude ".venv/*" "data/*" "tests/*" "**/__pycache__/*" ".env"
```
The Space builds the Docker image (about 5 minutes the first time).

### 5. Space settings -> Variables and secrets
| Kind | Name | Value |
|---|---|---|
| Secret | `DATABASE_URL` | the Neon connection string |
| Secret | `OPENROUTER_API_KEY` | from <https://openrouter.ai/keys> (AI features; optional) |
| Secret | `PAGESPEED_API_KEY` | optional (local Lighthouse is used otherwise) |
| Variable | `EMBEDDED_WORKER` | `true` (scheduled audits run inside the API) |
| Variable | `CORS_ORIGINS` | `https://rankwise-xi.vercel.app,https://rankwise.rudrai-gowri.workers.dev` |
| Variable | `PUBLIC_API_URL` | `https://<your-username>-rankwise-api.hf.space` |

Then **Restart** the Space. Check `https://<your-username>-rankwise-api.hf.space/api/health`.

### 6. Keep it awake
<https://cron-job.org> -> new job -> `https://<your-username>-rankwise-api.hf.space/api/health` every 30 minutes.

### 7. Frontend (Vercel, and Cloudflare if used)
Set `DATABASE_URL` (Neon), `BETTER_AUTH_SECRET` (32+ random characters), `BETTER_AUTH_URL` (the site URL),
`BACKEND_URL` and `NEXT_PUBLIC_API_URL` (the Space URL), then redeploy so the new values are built in.

---

## Render (free) + Neon Postgres

What the free tier gives: 512 MB RAM, so local Chromium/Lighthouse are left out of the image.
Speed comes from Google PageSpeed Insights; Accessibility and Visual Doctor show "unavailable" until you
move the service to **Standard (2 GB)** and set `WITH_BROWSER`, `BROWSER_CHECKS`, `LOCAL_LIGHTHOUSE` to `true`.
Free services sleep after 15 minutes idle; step 6 keeps it awake so monitoring keeps running.

### 1. Database: Neon (free, no expiry)
<https://neon.tech> → sign in with GitHub → **New project** `rankwise`, region **AWS Asia Pacific (Singapore)**
(same region as the Render service). Copy the **connection string**: `postgresql://…neon.tech/neondb?sslmode=require`.

### 2. Keys
- **PageSpeed Insights** (free): <https://console.cloud.google.com> → APIs & Services → enable *PageSpeed Insights API* → Credentials → **API key**.
- **OpenRouter** (AI features, pay per use): <https://openrouter.ai/keys>.

### 3. Create the sign-in tables (once, from this PC, before the first Render deploy)
The app's tables reference Better Auth's `user` table, so this must run first. PowerShell, from the repo root:
```powershell
cd frontend
$env:DATABASE_URL = Read-Host "Neon connection string" -MaskInput
npx -y auth@1.7.10 migrate --config src/lib/auth.ts --yes
Remove-Item Env:DATABASE_URL
```

### 4. Render: create the service from the Blueprint
<https://dashboard.render.com/blueprint/new?repo=https://github.com/mmahesh09/Ira-Analytics>
(if Render can't see the repo: **Account settings → GitHub → Configure** and grant it access to `Ira-Analytics`).
Render reads `render.yaml` and asks for three values: `DATABASE_URL` (the Neon string), `PAGESPEED_API_KEY`,
`OPENROUTER_API_KEY`. Click **Apply**. The first build takes a few minutes; on start the container runs
`alembic upgrade head`, which creates the rest of the tables.

Check: <https://rankwise-api.onrender.com/api/health> should report the database as ok.
(If Render gave the service a different URL, update `PUBLIC_API_URL` in its Environment tab.)

### 5. Vercel (Project → Settings → Environment Variables → Production), then Redeploy

| Name | Value |
|---|---|
| `DATABASE_URL` | the same Neon connection string |
| `BETTER_AUTH_SECRET` | a new random secret (`openssl rand -base64 32`, or any 32+ random characters) |
| `BETTER_AUTH_URL` | `https://rankwise-xi.vercel.app` |
| `BACKEND_URL` | `https://rankwise-api.onrender.com` |
| `NEXT_PUBLIC_API_URL` | `https://rankwise-api.onrender.com` |

### 6. Keep it awake (free)
<https://cron-job.org> → new cron job → URL `https://rankwise-api.onrender.com/api/health`, every **10 minutes**.
One always-on free service fits in Render's 750 free hours a month.

### 7. Check
Sign up on the live site, add a site, run an audit: SEO, AEO, GEO and Speed return; Render logs show
`worker started` and, after adding a site, `scheduled 1 site(s)`.

---

## Oracle Cloud Free VM + Coolify

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


### 1. Create the free VM (Oracle Cloud)

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

### 2. Install Coolify (open-source, self-hosted PaaS)

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```
Open `http://<VM_PUBLIC_IP>:8000`, create the admin account immediately (the first visitor becomes admin),
then **Sources → GitHub App → install** it on the `Ira-Analytics` repository.

### 3. Database (Coolify → New Resource → PostgreSQL 18)

1. Create it, then in its settings:
   - **Make it publicly available**: on, public port **5432**
   - **Enable SSL**: on
   - Keep the generated strong password.
2. Copy two connection strings from the resource page:
   - **internal URL** (for the backend, same server)
   - **public URL** (for Vercel)

### 4. Backend (Coolify → New Resource → Docker Compose → from GitHub)

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

### 5. Create the sign-in tables (once, from this laptop)

From the repo root on your PC, with the database's **public** URL (PowerShell):
```powershell
cd frontend
$env:DATABASE_URL = Read-Host "Public Postgres URL (postgres://...?sslmode=no-verify)" -MaskInput
npx -y auth@1.7.10 migrate --config src/lib/auth.ts --yes
Remove-Item Env:DATABASE_URL
```
Then press **Deploy** in Coolify. The api container runs `alembic upgrade head`, which creates every other
table, and starts. Check `https://<api-domain>/api/health`: it should report the database as ok.

### 6. Frontend (Vercel → Project → Settings → Environment Variables, Production)

| Name | Value |
|---|---|
| `DATABASE_URL` | the **public** Postgres URL, ending `?sslmode=no-verify` (encrypted; Coolify's certificate is self-signed) |
| `BETTER_AUTH_SECRET` | a new random secret: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `https://rankwise-xi.vercel.app` |
| `BACKEND_URL` | the api domain |
| `NEXT_PUBLIC_API_URL` | the api domain (the live audit stream connects to it directly) |

Redeploy. With the GitHub link working, every `git push` redeploys automatically.

### 7. Check it end to end

- Sign up on the live site, add a site, run an audit: every module returns, including Speed and Accessibility.
- In the report: priority chips, "Biggest wins", code snippets, and **Rewrite with AI**.
- Coolify → worker logs show `scheduled N site(s)` within a minute of adding a site.

### Local run (same stack)

```bash
# put values in a .env file next to docker-compose.yml (never commit it)
docker compose --profile bundled-db up -d --build
```

### Fallback: Hugging Face Spaces + Neon (if Oracle has no capacity)

- Database: a free Postgres at <https://neon.tech> (SSL included).
- Backend: a **Docker** Space built from `backend/Dockerfile`, with the same variables as step 4 and `PORT=7860`.
  Free Spaces sleep when idle and have no separate worker, so scheduled monitoring only runs while it's awake.
