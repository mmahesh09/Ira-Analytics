# Graph Report - neww  (2026-10-19)

## Corpus Check
- 133 files · ~84,062 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: (none) 9, .example 1, .ini 1)

## Summary
- 1159 nodes · 2938 edges · 57 communities (52 shown, 5 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 204 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `68fadb60`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Razorpay Payments
- Monitoring API Routes
- Deployment & Hosting Docs
- Auth & DB Session
- Link Crawler & Fetcher
- monitoring.tsx
- jobs.py
- main.py
- Fix Snippet Generators
- AI Fixes & Prioritization
- Root Layout & Feature Demos
- Score Plan & Simulator UI
- infographics.tsx
- Frontend Tooling Config
- page.py
- Site Workspace Pages
- (marketing)/page.tsx
- Auth & Marketing Layouts
- Issue Diffs & Regressions
- AI Rewrite UI
- shadcn Components Config
- Frontend Dependencies
- pricing/page.tsx
- credits.py
- geo.py
- module-panels.tsx
- apiFetch
- ORM Schema Models
- sites.py
- TypeScript Config
- billing.tsx
- auth-form.tsx
- features/page.tsx
- AI Content Optimization
- App Shell & Nav
- lucide-react
- geo.py
- Alembic Env
- audit-view.tsx
- test_deploy.py
- Better Auth Route & Proxy
- hero-preview.tsx
- visual-doctor.tsx
- Fix Verification Tests
- Dev Dependencies
- config.py
- NPM Scripts
- World Dots Build Script
- Next.js Starter Assets
- eslint.config.mjs
- runner.py
- Animated Badge
- Docker Entrypoint
- graphify Rules
- Dotted World Map
- boto3 Dependency

## God Nodes (most connected - your core abstractions)
1. `react` - 43 edges
2. `Page` - 38 edges
3. `Site` - 36 edges
4. `lucide-react` - 31 edges
5. `next` - 31 edges
6. `Base` - 26 edges
7. `run_audit()` - 24 edges
8. `Check` - 23 edges
9. `reserve()` - 22 edges
10. `Home()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `compose db service (postgres:18, bundled-db profile)` --conceptually_related_to--> `SQLAlchemy asyncio + asyncpg`  [INFERRED]
  docker-compose.yml → backend/requirements.txt
- `alembic upgrade head on container start` --references--> `alembic 1.14.0`  [INFERRED]
  DEPLOY.md → backend/requirements.txt
- `EMBEDDED_WORKER (scheduled audits inside API)` --conceptually_related_to--> `apscheduler 3.11.0`  [INFERRED]
  DEPLOY.md → backend/requirements.txt
- `SEO module (19 checks)` --conceptually_related_to--> `httpx + beautifulsoup4 + lxml`  [INFERRED]
  README.md → backend/requirements.txt
- `WITH_BROWSER / BROWSER_CHECKS / LOCAL_LIGHTHOUSE flags` --conceptually_related_to--> `playwright 1.49.1`  [INFERRED]
  DEPLOY.md → backend/requirements.txt

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Audit modules combined into overall score** — readme_seo_checks, readme_aeo_checks, readme_geo_checks, readme_speed_module, readme_overall_score [EXTRACTED 1.00]
- **Three free hosting options sharing one Docker image** — deploy_hugging_face_spaces, deploy_render_free_tier, deploy_oracle_cloud_free_vm, deploy_neon_postgres, deploy_coolify [EXTRACTED 1.00]
- **Database setup order: Better Auth tables then Alembic migrations** — deploy_better_auth_migration, deploy_alembic_upgrade_head, docker_compose_api_service, deploy_neon_postgres [INFERRED 0.85]
- **create-next-app default public assets** — frontend_public_file_document_icon, frontend_public_globe_globe_icon, frontend_public_next_nextjs_logo, frontend_public_vercel_vercel_logo, frontend_public_window_browser_window_icon [INFERRED 0.95]

## Communities (57 total, 5 thin omitted)

### Community 0 - "Razorpay Payments"
Cohesion: 0.06
Nodes (33): cancel_subscription(), configured(), create_plan(), create_subscription(), fetch_subscription(), _hmac(), list_plans(), PaymentsError (+25 more)

### Community 1 - "Monitoring API Routes"
Cohesion: 0.10
Nodes (31): handle_verify(), fingerprints(), module_score(), record_audit(), AlertOut, alerts(), audit_now(), audit_report() (+23 more)

### Community 2 - "Deployment & Hosting Docs"
Cohesion: 0.07
Nodes (37): Rankwise API (HF Space, sdk: docker, app_port 8000), alembic 1.14.0, apscheduler 3.11.0, fastapi 0.115.6, httpx + beautifulsoup4 + lxml, playwright 1.49.1, SQLAlchemy asyncio + asyncpg, alembic upgrade head on container start (+29 more)

### Community 3 - "Auth & DB Session"
Cohesion: 0.16
Nodes (7): current_user(), owned_site(), _session_token(), get_session(), me(), UserOut, User

### Community 4 - "Link Crawler & Fetcher"
Cohesion: 0.18
Nodes (9): crawl_links(), check(), LinkResult, _assert_public_host(), AuditError, check_status(), fetch(), fetch_optional() (+1 more)

### Community 5 - "monitoring.tsx"
Cohesion: 0.14
Nodes (20): Links(), metadata, metadata, Monitoring(), ALERT_ICON, BeforeAfter(), ChangeLog(), dateShort (+12 more)

### Community 6 - "jobs.py"
Cohesion: 0.13
Nodes (13): claim(), enqueue(), finish(), handle_audit(), handle_links(), run(), lifespan(), effective_plan() (+5 more)

### Community 7 - "main.py"
Cohesion: 0.09
Nodes (20): _list(), _allow(), audit(), audit_stream(), events(), _client_ip(), health(), screenshot() (+12 more)

### Community 8 - "Fix Snippet Generators"
Cohesion: 0.22
Nodes (24): _ai_crawlers(), _breadcrumbs(), _canonical(), _clean_url(), _clip(), _description(), _faq(), _favicon() (+16 more)

### Community 9 - "AI Fixes & Prioritization"
Cohesion: 0.16
Nodes (17): snippet_for(), annotate(), severity(), _prompt(), chk(), _jsonld_body(), page(), site() (+9 more)

### Community 10 - "Root Layout & Feature Demos"
Cohesion: 0.09
Nodes (19): googleSans, interTight, jetbrains, metadata, RootLayout(), viewport, BARS, BOTS (+11 more)

### Community 11 - "Score Plan & Simulator UI"
Cohesion: 0.12
Nodes (28): Group(), OpportunityPlan(), VALUE, Candidate, CountUp(), MODULES, rtf, SCORED_MODULES (+20 more)

### Community 12 - "infographics.tsx"
Cohesion: 0.12
Nodes (26): ChecksByModule(), COLOR, ProjectionBars(), rowOf(), SEVERITIES, Severity, SeverityDonut(), subscribeMotion() (+18 more)

### Community 13 - "Frontend Tooling Config"
Cohesion: 0.10
Nodes (18): name, private, version, axe-core, @neon/config, @neon/env, @opennextjs/cloudflare, playwright (+10 more)

### Community 14 - "page.py"
Cohesion: 0.20
Nodes (5): first_json_object(), _flatten_jsonld(), parse_page(), _types(), test_first_json_object_handles_fences()

### Community 15 - "Site Workspace Pages"
Cohesion: 0.18
Nodes (16): AppHome(), SitePage(), byPriority(), HistoryChart(), AddSiteForm(), CADENCES, FixFirst(), SiteOverview() (+8 more)

### Community 16 - "(marketing)/page.tsx"
Cohesion: 0.17
Nodes (23): FeaturesPage(), Chapter(), ENGINES, FAQS, Home(), SampleTag(), STEPS, A11yVisual() (+15 more)

### Community 17 - "Auth & Marketing Layouts"
Cohesion: 0.17
Nodes (15): nextConfig, AuthLayout(), MarketingLayout(), AuthShowcase(), MODULES, POINTS, RevealObserver(), NAV (+7 more)

### Community 18 - "Issue Diffs & Regressions"
Cohesion: 0.14
Nodes (15): is_broken(), diff_issues(), IssueDiff, measured(), next_run(), regressions(), check(), report() (+7 more)

### Community 19 - "AI Rewrite UI"
Cohesion: 0.11
Nodes (25): AiRewrite(), run(), bare(), CopyText(), Field, FIELD_LABEL, REWRITE_FIELD, RewriteResult (+17 more)

### Community 20 - "shadcn Components Config"
Cohesion: 0.10
Nodes (20): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+12 more)

### Community 21 - "Frontend Dependencies"
Cohesion: 0.10
Nodes (21): dependencies, axe-core, better-auth, class-variance-authority, clsx, framer-motion, lucide-react, @neon/config (+13 more)

### Community 22 - "pricing/page.tsx"
Cohesion: 0.15
Nodes (23): FAQS, metadata, PricingPage(), Cell(), CompareTable(), CurrencyToggle(), onKeyDown(), getServerSnapshot() (+15 more)

### Community 23 - "credits.py"
Cohesion: 0.10
Nodes (34): balance(), Balance, capture(), ensure_monthly_grant(), grant(), InsufficientCredits, _ledger(), lock_user() (+26 more)

### Community 24 - "geo.py"
Cohesion: 0.17
Nodes (12): analyze_accessibility(), score_checks(), summarize(), AuditRequest, Check, _browser_path(), from_lighthouse(), _plain() (+4 more)

### Community 25 - "module-panels.tsx"
Cohesion: 0.34
Nodes (13): ReportPanel(), ChartTip(), PositionsChart(), SplitDonut(), LengthMeter(), AeoExtras(), bandRange(), Card() (+5 more)

### Community 26 - "apiFetch"
Cohesion: 0.18
Nodes (15): Issues(), metadata, SiteSettingsPage(), AlertsBell(), markRead(), IssuesPage(), markFixed(), useApi() (+7 more)

### Community 27 - "ORM Schema Models"
Cohesion: 0.12
Nodes (13): AiPrompt, AiRun, AuthSession, Base, BillingEvent, Competitor, CreditOrder, Event (+5 more)

### Community 28 - "sites.py"
Cohesion: 0.20
Nodes (10): clean_domain(), create_site(), delete_site(), get_site(), list_sites(), _out(), SiteIn, SiteOut (+2 more)

### Community 29 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 30 - "billing.tsx"
Cohesion: 0.15
Nodes (15): Billing(), metadata, BillingPage(), upgrade(), waitForActivation(), CheckoutSuccess, dateFmt, loadCheckout() (+7 more)

### Community 31 - "auth-form.tsx"
Cohesion: 0.19
Nodes (13): LoginPage(), metadata, metadata, SignupPage(), AuthForm(), submit(), describe(), Field() (+5 more)

### Community 32 - "features/page.tsx"
Cohesion: 0.15
Nodes (9): metadata, ORDER, VISUALS, Chapter, CHAPTERS, Feature, FEATURES, FeatureStatus (+1 more)

### Community 33 - "AI Content Optimization"
Cohesion: 0.20
Nodes (9): _current(), _first_question(), _month_start(), _options(), rewrite(), RewriteIn, RewriteOption, RewriteOut (+1 more)

### Community 34 - "App Shell & Nav"
Cohesion: 0.22
Nodes (11): AppLayout(), metadata, AppShell(), Sidebar(), SITE_NAV, SiteMark(), Workspace, WorkspaceContext (+3 more)

### Community 35 - "lucide-react"
Cohesion: 0.11
Nodes (26): AccordionContent, AccordionItem, AccordionTrigger, Badge(), BadgeProps, badgeVariants, Button, ButtonProps (+18 more)

### Community 36 - "geo.py"
Cohesion: 0.24
Nodes (6): SiteFiles, analyze_geo(), _crawler_access(), _modified_date(), _visibility_probes(), chat()

### Community 37 - "Alembic Env"
Cohesion: 0.21
Nodes (5): do_run_migrations(), include_object(), run_async_migrations(), run_migrations_offline(), run_migrations_online()

### Community 38 - "audit-view.tsx"
Cohesion: 0.10
Nodes (24): AuditPage(), metadata, AuditRun(), AuditView(), EASE, ModuleHeader(), ProgressLog(), Sidebar() (+16 more)

### Community 39 - "test_deploy.py"
Cohesion: 0.24
Nodes (6): async_db_url(), test_embedded_worker_runs_with_the_app_and_stops_on_shutdown(), fake_loop(), test_neon_url_becomes_asyncpg_with_ssl(), test_no_embedded_worker_by_default(), test_other_url_shapes()

### Community 40 - "Better Auth Route & Proxy"
Cohesion: 0.20
Nodes (8): GET, POST, auth, pool, config, better-auth, pg, @vercel/functions

### Community 41 - "hero-preview.tsx"
Cohesion: 0.24
Nodes (9): BARS, HeroPreview(), ISSUES, NAV, Priority(), AuditConsole(), LINES, MODULES (+1 more)

### Community 42 - "visual-doctor.tsx"
Cohesion: 0.29
Nodes (5): Box, IMPACT, Violation, VisualDoctor(), ModuleResult

### Community 43 - "Fix Verification Tests"
Cohesion: 0.38
Nodes (8): verify_outcome(), report(), test_fixed_when_the_check_no_longer_applies(), test_fixed_when_the_check_now_passes(), test_info_counts_as_fixed(), test_module_score(), test_still_failing_on_warn_or_fail(), test_unmeasured_when_the_module_could_not_run()

### Community 44 - "Dev Dependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/turbopack, @types/node, @types/pg, @types/react (+3 more)

### Community 45 - "config.py"
Cohesion: 0.11
Nodes (5): upgrade(), upgrade(), Settings, Entitlements, Pack

### Community 46 - "NPM Scripts"
Cohesion: 0.25
Nodes (8): scripts, build, cf:build, cf:deploy, cf:preview, dev, lint, start

### Community 47 - "World Dots Build Script"
Cohesion: 0.29
Nodes (6): path, { points }, r(), rows, sorted, svg-dotted-map

### Community 48 - "Next.js Starter Assets"
Cohesion: 0.33
Nodes (6): File/Document Icon (file.svg), Globe Icon (globe.svg), create-next-app Starter Assets, Next.js Wordmark Logo (next.svg), Vercel Triangle Logo (vercel.svg), Browser Window Icon (window.svg)

### Community 49 - "eslint.config.mjs"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint, eslint-config-next

### Community 50 - "runner.py"
Cohesion: 0.14
Nodes (16): analyze_aeo(), _answer_lengths(), overall_score(), make_client(), normalize_url(), AuditReport, ModuleResult, analyze_performance() (+8 more)

### Community 52 - "Animated Badge"
Cohesion: 0.67
Nodes (3): AnimatedBadge(), AnimatedBadgeProps, hexToRgba()

## Ambiguous Edges - Review These
- `Ira Analytics` → `Rankwise - SEO, AEO & GEO website audit`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to

## Knowledge Gaps
- **34 isolated node(s):** `@neon/env`, `axe-core`, `playwright`, `react-dom`, `@tailwindcss/turbopack` (+29 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 397 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App Shell & Nav` to `features/page.tsx`, `lucide-react`, `monitoring.tsx`, `audit-view.tsx`, `visual-doctor.tsx`, `Score Plan & Simulator UI`, `infographics.tsx`, `Frontend Tooling Config`, `Root Layout & Feature Demos`, `Site Workspace Pages`, `(marketing)/page.tsx`, `Auth & Marketing Layouts`, `AI Rewrite UI`, `pricing/page.tsx`, `module-panels.tsx`, `apiFetch`, `billing.tsx`, `auth-form.tsx`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Are the 30 inferred relationships involving `Page` (e.g. with `analyze_aeo()` and `_answer_lengths()`) actually correct?**
  _`Page` has 30 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@neon/env`, `axe-core`, `playwright` to the rest of the system?**
  _34 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Razorpay Payments` be split into smaller, more focused modules?**
  _Cohesion score 0.06253652834599649 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `lucide-react` to `monitoring.tsx`, `Root Layout & Feature Demos`, `Score Plan & Simulator UI`, `infographics.tsx`, `Frontend Tooling Config`, `Site Workspace Pages`, `(marketing)/page.tsx`, `Auth & Marketing Layouts`, `AI Rewrite UI`, `pricing/page.tsx`, `module-panels.tsx`, `billing.tsx`, `auth-form.tsx`, `features/page.tsx`, `App Shell & Nav`, `audit-view.tsx`, `hero-preview.tsx`, `visual-doctor.tsx`, `Animated Badge`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Are the 27 inferred relationships involving `Site` (e.g. with `owned_site()` and `handle_audit()`) actually correct?**
  _`Site` has 27 INFERRED edges - model-reasoned connections that need verification._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Ira Analytics` and `Rankwise - SEO, AEO & GEO website audit`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._