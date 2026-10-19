# Rankwise — SEO, AEO & GEO website audit

Paste a URL, get scores for classic search (SEO), answer engines (AEO) and AI assistants (GEO), plus Core Web Vitals and optional traffic estimates — with a ranked fix list.

```
frontend/  Next.js 16 (App Router, Tailwind v4, Framer Motion, lucide-react)
backend/   FastAPI · httpx · BeautifulSoup — streams results over Server-Sent Events
```

## Run locally

```bash
# backend (http://localhost:8000)
cd backend
python -m venv .venv && .venv\Scripts\activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                                 # optional keys, see below
uvicorn app.main:app --reload --port 8000

# frontend (http://localhost:3000)
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Optional API keys (backend `.env` only — never in the frontend)

| Variable | Enables | Without it |
|---|---|---|
| `PAGESPEED_API_KEY` | Lighthouse / Core Web Vitals (free key from Google Cloud) | Uses Google's shared quota, often exhausted → Speed shows "n/a" |
| `OPENROUTER_API_KEY` + `GEO_MODELS` | Live AI-visibility test: asks real models buyer questions and checks if the brand is mentioned | GEO still runs all static checks |
| `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` | Estimated organic traffic, ranking keywords, position spread | Traffic tab explains how to enable |

## What's checked

- **SEO (19 checks):** HTTPS, title/meta length, H1 + heading order, indexability, canonical, viewport, lang, Open Graph, image alt, word count, structured data, robots.txt, sitemap, favicon, internal links, broken links (up to 25), server response time.
- **AEO (7):** FAQ/HowTo/QAPage schema, question headings, snippet-length answers, lists/tables, breadcrumbs, page-type schema, answer-shaped description.
- **GEO (9):** access for 8 AI crawlers, llms.txt, content readable without JS, Organization entity + sameAs, authorship, freshness, statistics, outbound citations, live AI mentions (with key).
- **Speed:** Lighthouse mobile score, LCP, CLS, TBT, FCP, Speed Index, top opportunities, CrUX field data.

Overall score = SEO 35% · GEO 25% · AEO 20% · Speed 20% (unavailable modules are re-weighted out). Traffic is reported, not scored.

## API

- `GET /api/health` — feature flags
- `GET /api/audit/stream?url=` — SSE events: `stage`, `module`, `warning`, `result`, `error`
- `POST /api/audit {"url": "..."}` — full JSON report

## Safety

Outbound fetches reject private/loopback/reserved IPs on every redirect hop, cap body size at 3 MB, and time out after 15 s. Audits are rate-limited per IP (default 10 per 10 min) and cached for 15 min.

## Not built yet

Google Search Console / GA4 connection for real (not estimated) traffic, competitor comparison, chat over your site data, PDF and white-label reports. See `frontend/src/lib/features.ts` (features marked `soon`).
