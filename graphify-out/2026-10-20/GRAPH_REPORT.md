# Graph Report - neww  (2026-10-20)

## Corpus Check
- 216 files · ~193,123 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: (none) 12, .excalidraw 5, .example 2)

## Summary
- 2088 nodes · 5279 edges · 95 communities (86 shown, 9 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 375 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b566db86`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- billing.py
- Monitoring API Routes
- Deployment & Hosting Docs
- sites.py
- test_http_security.py
- site-pages.tsx
- jobs.py
- storage.py
- Fix Snippet Generators
- AI Fixes & Prioritization
- Root Layout & Feature Demos
- scoring.ts
- test_payments.py
- Frontend Tooling Config
- feedback-form.tsx
- EgressProxy
- features/page.tsx
- next
- Issue Diffs & Regressions
- check-list.tsx
- shadcn Components Config
- Frontend Dependencies
- pricing/page.tsx
- credits.py
- geo.py
- audit-view.tsx
- security.py
- schema.py
- app/main.py
- TypeScript Config
- scenes.tsx
- auth-recovery.tsx
- RankwiseFilm.tsx
- content.py
- App Shell & Nav
- lucide-react
- test_feedback.py
- config.py
- UrlForm
- monitoring.tsx
- route.ts
- compilerOptions
- make_user
- content.py
- Dev Dependencies
- account.tsx
- NPM Scripts
- site-header.tsx
- Next.js Starter Assets
- feedback-admin.tsx
- profile-dropdown.tsx
- Diagram
- FeedbackAdmin
- Docker Entrypoint
- graphify Rules
- Dotted World Map
- boto3 Dependency
- STEPS
- make-sfx.mjs
- hyperframes.json
- Rankwise launch video
- video/package.json
- RankwiseLaunch.tsx
- scripts
- (marketing)/page.tsx
- billing.tsx
- action-search-bar.tsx
- HyperFrames Composition Project
- HyperFrames Composition Project
- auth.ts
- main.py
- sqlalchemy
- AuthForm
- next.config.ts
- app/auth.py
- animated-badge.tsx
- better-auth
- fields.tsx
- Rankwise security hardening report
- test_verification.py
- conftest.py
- feedback.e2e.mjs
- dependencies
- Settings
- fake_llm
- format.ts
- page.py
- charts.tsx
- ref_react
- receipt-printer.tsx
- background-paths.tsx
- ai-rewrite.tsx
- infographics.tsx
- api.ts

## God Nodes (most connected - your core abstractions)
1. `Site` - 53 edges
2. `make_user()` - 51 edges
3. `next` - 51 edges
4. `Page` - 38 edges
5. `login()` - 31 edges
6. `Base` - 28 edges
7. `User` - 28 edges
8. `cn()` - 27 edges
9. `reserve()` - 26 edges
10. `Job` - 26 edges

## Surprising Connections (you probably didn't know these)
- `Low` --references--> `is_public_ip()`  [INFERRED]
  SECURITY.md → backend/app/fetcher.py
- `Medium` --references--> `OriginCheck`  [INFERRED]
  SECURITY.md → backend/app/security.py
- `Medium` --references--> `test_production_settings_fail_closed()`  [INFERRED]
  SECURITY.md → backend/tests/test_http_security.py
- `Cinematic film (`RankwiseFilm`)` --references--> `RankwiseFilm()`  [INFERRED]
  video/README.md → video/src/film/RankwiseFilm.tsx
- `Original promo (`RankwiseLaunch`)` --references--> `RankwiseLaunch()`  [INFERRED]
  video/README.md → video/src/RankwiseLaunch.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Audit modules combined into overall score** — readme_seo_checks, readme_aeo_checks, readme_geo_checks, readme_speed_module, readme_overall_score [EXTRACTED 1.00]
- **Three free hosting options sharing one Docker image** — deploy_hugging_face_spaces, deploy_render_free_tier, deploy_oracle_cloud_free_vm, deploy_neon_postgres, deploy_coolify [EXTRACTED 1.00]
- **Database setup order: Better Auth tables then Alembic migrations** — deploy_better_auth_migration, deploy_alembic_upgrade_head, docker_compose_api_service, deploy_neon_postgres [INFERRED 0.85]
- **create-next-app default public assets** — frontend_public_file_document_icon, frontend_public_globe_globe_icon, frontend_public_next_nextjs_logo, frontend_public_vercel_vercel_logo, frontend_public_window_browser_window_icon [INFERRED 0.95]

## Communities (95 total, 9 thin omitted)

### Community 0 - "billing.py"
Cohesion: 0.05
Nodes (55): cancel_subscription(), configured(), create_order(), create_plan(), create_subscription(), fetch_payment(), fetch_subscription(), _hmac() (+47 more)

### Community 1 - "Monitoring API Routes"
Cohesion: 0.09
Nodes (28): _settle_verifications(), AlertOut, alerts(), audit_now(), audit_report(), AuditNowIn, AuditPoint, check_now() (+20 more)

### Community 2 - "Deployment & Hosting Docs"
Cohesion: 0.07
Nodes (37): Rankwise API (HF Space, sdk: docker, app_port 8000), alembic 1.14.0, apscheduler 3.11.0, fastapi 0.115.6, httpx + beautifulsoup4 + lxml, playwright 1.49.1, SQLAlchemy asyncio + asyncpg, alembic upgrade head on container start (+29 more)

### Community 3 - "sites.py"
Cohesion: 0.18
Nodes (11): clean_domain(), create_site(), delete_site(), get_site(), list_sites(), _out(), SiteIn, SiteOut (+3 more)

### Community 4 - "test_http_security.py"
Cohesion: 0.14
Nodes (22): AiRewrite, login(), _api_routes(), client(), _site_routes(), test_cookie_writes_need_a_trusted_origin(), test_cors_allows_only_listed_origins_without_credentials(), test_crawled_links_keep_only_http_urls() (+14 more)

### Community 5 - "site-pages.tsx"
Cohesion: 0.12
Nodes (26): AppHome(), Links(), metadata, SitePage(), SiteSettingsPage(), byPriority(), LinksPage(), AddSiteForm() (+18 more)

### Community 6 - "jobs.py"
Cohesion: 0.09
Nodes (21): add(), checks_today(), claim(), enqueue(), enqueue_check(), finish(), handle_audit(), handle_check() (+13 more)

### Community 7 - "storage.py"
Cohesion: 0.17
Nodes (11): bucket_configured(), _client(), _get(), load_shot(), _put(), save_shot(), FakeS3, exceptions (+3 more)

### Community 8 - "Fix Snippet Generators"
Cohesion: 0.22
Nodes (24): _ai_crawlers(), _breadcrumbs(), _canonical(), _clean_url(), _clip(), _description(), _faq(), _favicon() (+16 more)

### Community 9 - "AI Fixes & Prioritization"
Cohesion: 0.15
Nodes (18): snippet_for(), annotate(), severity(), _prompt(), chk(), _jsonld_body(), page(), site() (+10 more)

### Community 10 - "Root Layout & Feature Demos"
Cohesion: 0.09
Nodes (19): googleSans, interTight, jetbrains, metadata, RootLayout(), viewport, BARS, BOTS (+11 more)

### Community 11 - "scoring.ts"
Cohesion: 0.22
Nodes (15): Group(), OpportunityPlan(), ScoreSimulator(), cumulative(), EFFORT_LABEL, fixKey(), overallScore(), prioritize() (+7 more)

### Community 12 - "test_payments.py"
Cohesion: 0.26
Nodes (16): client(), hook(), _monthly(), _sig(), sub_entity(), subscribed(), test_charged_grants_once_even_for_duplicate_and_concurrent_deliveries(), test_checkout_verify_grants_once_and_the_webhook_adds_nothing() (+8 more)

### Community 13 - "Frontend Tooling Config"
Cohesion: 0.07
Nodes (24): eslintConfig, lucide-react, react, react-dom, @types/react, typescript, name, private (+16 more)

### Community 14 - "feedback-form.tsx"
Cohesion: 0.10
Nodes (27): FeedbackPage(), metadata, Draft, FeedbackForm(), noSubscribe(), posthogEnabled, Status, blank() (+19 more)

### Community 15 - "EgressProxy"
Cohesion: 0.08
Nodes (21): EgressProxy, _pipe(), _split_host_port(), fake_dns(), Internal, _send(), test_authority_parsing(), test_bad_ports_are_rejected() (+13 more)

### Community 16 - "features/page.tsx"
Cohesion: 0.16
Nodes (13): FeaturesPage(), metadata, ORDER, StatusTag(), MonitorScene(), VISUALS, byChapter(), Chapter (+5 more)

### Community 17 - "next"
Cohesion: 0.14
Nodes (22): ContactPage(), metadata, TOPICS, CookiesPage(), metadata, SECTIONS, STORED, metadata (+14 more)

### Community 18 - "Issue Diffs & Regressions"
Cohesion: 0.11
Nodes (18): is_broken(), diff_issues(), fingerprints(), IssueDiff, measured(), module_score(), next_run(), record_audit() (+10 more)

### Community 19 - "check-list.tsx"
Cohesion: 0.11
Nodes (23): CheckItem(), CodeFix(), CopyButton(), Filter, SEVERITY_CHIP, STATUS_META, bandRange(), Box (+15 more)

### Community 20 - "shadcn Components Config"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+13 more)

### Community 21 - "Frontend Dependencies"
Cohesion: 0.07
Nodes (27): dependencies, axe-core, better-auth, class-variance-authority, clsx, framer-motion, lucide-react, motion (+19 more)

### Community 22 - "pricing/page.tsx"
Cohesion: 0.15
Nodes (23): FAQS, metadata, PricingPage(), splitTitle(), Cell(), CompareTable(), CurrencyToggle(), onKeyDown() (+15 more)

### Community 23 - "credits.py"
Cohesion: 0.11
Nodes (30): balance(), Balance, capture(), ensure_monthly_grant(), grant(), InsufficientCredits, _ledger(), lock_user() (+22 more)

### Community 24 - "geo.py"
Cohesion: 0.10
Nodes (29): analyze_accessibility(), analyze_aeo(), _answer_lengths(), overall_score(), score_checks(), SiteFiles, summarize(), analyze_geo() (+21 more)

### Community 25 - "audit-view.tsx"
Cohesion: 0.14
Nodes (24): AuditRun(), EASE, ModuleHeader(), ProgressLog(), ReportPanel(), Sidebar(), STAGES, Tab (+16 more)

### Community 26 - "security.py"
Cohesion: 0.13
Nodes (4): BodyLimit, _has_session(), OriginCheck, SecurityHeaders

### Community 27 - "schema.py"
Cohesion: 0.11
Nodes (20): prune_old_data(), AiPrompt, AiRun, Alert, ApiRate, Audit, AuthSession, Base (+12 more)

### Community 28 - "app/main.py"
Cohesion: 0.11
Nodes (11): audit(), audit_stream(), events(), health(), lifespan(), screenshot(), _sse(), _take_preview() (+3 more)

### Community 29 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 30 - "scenes.tsx"
Cohesion: 0.14
Nodes (35): BARS, DASH_H, DASH_W, Dashboard(), FilterChips(), IssueRow(), ISSUES, NAV (+27 more)

### Community 31 - "auth-recovery.tsx"
Cohesion: 0.16
Nodes (22): ForgotPasswordPage(), metadata, metadata, ResetPasswordPage(), metadata, TwoFactorPage(), Field(), AuthError (+14 more)

### Community 32 - "RankwiseFilm.tsx"
Cohesion: 0.19
Nodes (15): Atmosphere(), Grade(), Grain(), FILM_DURATION, RankwiseFilm(), ROWS, Sfx(), shot() (+7 more)

### Community 33 - "content.py"
Cohesion: 0.08
Nodes (21): _network_guard(), guard(), _assert_public_host(), AuditError, check_status(), fetch(), fetch_optional(), FetchResult (+13 more)

### Community 34 - "App Shell & Nav"
Cohesion: 0.18
Nodes (14): AppLayout(), metadata, AppShell(), identifyUser(), posthogEnabled, Sidebar(), SITE_NAV, SiteMark() (+6 more)

### Community 35 - "lucide-react"
Cohesion: 0.11
Nodes (24): AccordionContent, AccordionItem, AccordionTrigger, Badge(), BadgeProps, badgeVariants, Button, ButtonProps (+16 more)

### Community 36 - "test_feedback.py"
Cohesion: 0.07
Nodes (32): _clean(), FeedbackIn, _csv_cell(), export_feedback(), feedback_detail(), feedback_stats(), top(), Filters (+24 more)

### Community 37 - "config.py"
Cohesion: 0.10
Nodes (13): do_run_migrations(), include_object(), run_async_migrations(), run_migrations_offline(), run_migrations_online(), async_db_url(), _list(), _production() (+5 more)

### Community 38 - "UrlForm"
Cohesion: 0.38
Nodes (6): AuditPage(), metadata, AuditView(), UrlForm(), submit(), cleanUrl()

### Community 39 - "monitoring.tsx"
Cohesion: 0.10
Nodes (31): Issues(), metadata, metadata, Monitoring(), ALERT_ICON, AlertsBell(), markRead(), BeforeAfter() (+23 more)

### Community 40 - "route.ts"
Cohesion: 0.20
Nodes (11): posthogLog, posthogLogProvider, authHandlers, flushPostHogLogs(), GET(), handleAuthRequest(), POST(), @opentelemetry/api-logs (+3 more)

### Community 41 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, jsx, lib, module, moduleResolution, noEmit (+5 more)

### Community 42 - "make_user"
Cohesion: 0.20
Nodes (21): make_site(), make_user(), audits(), fake_audit_once(), client(), fake_report(), _jobs(), test_anonymous_preview_is_light_capped_and_ignores_spoofed_ips() (+13 more)

### Community 43 - "content.py"
Cohesion: 0.15
Nodes (13): make_client(), _visibility_probes(), chat(), first_json_object(), _current(), _first_question(), _month_start(), _options() (+5 more)

### Community 44 - "Dev Dependencies"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/turbopack, @types/node, @types/pg, @types/react (+3 more)

### Community 45 - "account.tsx"
Cohesion: 0.22
Nodes (17): Account(), metadata, AccountPage(), AuthError, ChangePassword(), submit(), explain(), Message() (+9 more)

### Community 46 - "NPM Scripts"
Cohesion: 0.25
Nodes (8): scripts, build, cf:build, cf:deploy, cf:preview, dev, lint, start

### Community 47 - "site-header.tsx"
Cohesion: 0.21
Nodes (13): AuthLayout(), MarketingLayout(), AuthShowcase(), MODULES, POINTS, RevealObserver(), SiteFooter(), Logo() (+5 more)

### Community 48 - "Next.js Starter Assets"
Cohesion: 0.33
Nodes (6): File/Document Icon (file.svg), Globe Icon (globe.svg), create-next-app Starter Assets, Next.js Wordmark Logo (next.svg), Vercel Triangle Logo (vercel.svg), Browser Window Icon (window.svg)

### Community 49 - "feedback-admin.tsx"
Cohesion: 0.13
Nodes (24): dateFmt, dateTimeFmt, Detail(), fmt(), Load, OutOf(), Requests(), Skeleton() (+16 more)

### Community 50 - "profile-dropdown.tsx"
Cohesion: 0.09
Nodes (33): Account, AccountStatus, AccountTheme, Avatar(), AVATAR_TONES, EASE_OUT, HoldSignOut(), Identity() (+25 more)

### Community 51 - "Diagram"
Cohesion: 0.36
Nodes (6): audit_workflow(), data_model(), Diagram, payment_workflow(), scheduler(), system_architecture()

### Community 52 - "FeedbackAdmin"
Cohesion: 0.16
Nodes (11): AdminFeedback(), metadata, ErrorBox(), errorMessage(), FeedbackAdmin(), Filters(), useDebounced(), exportUrl() (+3 more)

### Community 58 - "STEPS"
Cohesion: 0.21
Nodes (13): newId(), Progress(), readDraft(), saveDraft(), STEPS, focusFirstError(), go(), next() (+5 more)

### Community 59 - "make-sfx.mjs"
Cohesion: 0.15
Nodes (14): path, { points }, r(), rows, sorted, svg-dotted-map, buffer(), finish() (+6 more)

### Community 60 - "hyperframes.json"
Cohesion: 0.18
Nodes (10): authoringSkill, media, autoProxy, paths, assets, blocks, components, registry (+2 more)

### Community 61 - "Rankwise launch video"
Cohesion: 0.29
Nodes (6): Cinematic film (`RankwiseFilm`), Music, Original promo (`RankwiseLaunch`), Rankwise launch video, Scenes, Voiceover (optional)

### Community 62 - "video/package.json"
Cohesion: 0.08
Nodes (23): @remotion/cli, @remotion/google-fonts, @remotion/media, @remotion/transitions, description, devDependencies, @types/react, typescript (+15 more)

### Community 63 - "RankwiseLaunch.tsx"
Cohesion: 0.09
Nodes (37): remotion, Backdrop(), Logo(), LogoMark(), clamp, DURATION, LaunchProps, RankwiseLaunch() (+29 more)

### Community 64 - "scripts"
Cohesion: 0.22
Nodes (8): name, private, scripts, check, dev, publish, render, type

### Community 65 - "(marketing)/page.tsx"
Cohesion: 0.12
Nodes (27): Chapter(), ENGINES, FAQS, Home(), SampleTag(), STEPS, BARS, HeroPreview() (+19 more)

### Community 66 - "billing.tsx"
Cohesion: 0.09
Nodes (29): Billing(), metadata, BillingPage(), buyPack(), changePlan(), upgrade(), waitForActivation(), CheckoutSuccess (+21 more)

### Community 67 - "action-search-bar.tsx"
Cohesion: 0.16
Nodes (23): Action, ActionSearchBar(), ActionSearchBarProps, buildSections(), Entry, findEntry(), flatten(), fuzzyMatch() (+15 more)

### Community 68 - "HyperFrames Composition Project"
Cohesion: 0.25
Nodes (7): Commands, Documentation, HyperFrames Composition Project, Key Rules, Linting — ALWAYS RUN AFTER CHANGES, Project Structure, Skills — USE THESE FIRST

### Community 69 - "HyperFrames Composition Project"
Cohesion: 0.25
Nodes (7): Commands, Documentation, HyperFrames Composition Project, Key Rules, Linting — ALWAYS RUN AFTER CHANGES, Project Structure, Skills — USE THESE FIRST

### Community 70 - "auth.ts"
Cohesion: 0.22
Nodes (12): auth, emailOf(), pool, sendLater(), signinKey(), signinWindow(), emailEnabled, Message (+4 more)

### Community 72 - "sqlalchemy"
Cohesion: 0.21
Nodes (4): upgrade(), upgrade(), upgrade(), upgrade()

### Community 73 - "AuthForm"
Cohesion: 0.17
Nodes (14): LoginPage(), metadata, metadata, SignupPage(), AuthForm(), submit(), describe(), fieldClass (+6 more)

### Community 74 - "next.config.ts"
Cohesion: 0.40
Nodes (3): apiOrigin, csp, nextConfig

### Community 75 - "app/auth.py"
Cohesion: 0.13
Nodes (8): admin_user(), current_user(), is_admin(), owned_site(), _session_token(), get_session(), me(), UserOut

### Community 76 - "animated-badge.tsx"
Cohesion: 0.67
Nodes (3): AnimatedBadge(), AnimatedBadgeProps, hexToRgba()

### Community 78 - "fields.tsx"
Cohesion: 0.31
Nodes (13): border(), CheckboxGroup(), chipState(), ChoiceGroup(), ErrorText(), inputClass, Legend(), OtherInput() (+5 more)

### Community 79 - "Rankwise security hardening report"
Cohesion: 0.14
Nodes (13): 10. Manual actions, in priority order, 11. Open items, 12. Before deploying, 1. Executive summary, 2. Stack, 3–4. Findings and fixes, 5. Files, 6. Database changes (+5 more)

### Community 80 - "test_verification.py"
Cohesion: 0.38
Nodes (8): verify_outcome(), report(), test_fixed_when_the_check_no_longer_applies(), test_fixed_when_the_check_now_passes(), test_info_counts_as_fixed(), test_module_score(), test_still_failing_on_warn_or_fail(), test_unmeasured_when_the_module_could_not_run()

### Community 82 - "feedback.e2e.mjs"
Cohesion: 0.14
Nodes (4): results, pages, results, playwright

### Community 83 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, lucide-react, react, react-dom, remotion, @remotion/cli, @remotion/google-fonts, @remotion/media (+1 more)

### Community 84 - "Settings"
Cohesion: 0.33
Nodes (4): Settings, _prod(), test_production_settings_fail_closed(), Medium

### Community 86 - "format.ts"
Cohesion: 0.17
Nodes (14): VALUE, Candidate, CountUp(), MODULES, rtf, SCORED_MODULES, STATUS_TONE, STEPS (+6 more)

### Community 87 - "page.py"
Cohesion: 0.21
Nodes (6): crawl_links(), check(), LinkResult, _flatten_jsonld(), parse_page(), _types()

### Community 88 - "charts.tsx"
Cohesion: 0.23
Nodes (15): ChartTip(), ChecksByModule(), COLOR, PositionsChart(), ProjectionBars(), rowOf(), SEVERITIES, Severity (+7 more)

### Community 89 - "ref_react"
Cohesion: 0.15
Nodes (7): posthogEnabled, Loader(), LoaderProps, RINGS, SIZE_CONFIG, posthogEnabled, posthog-js

### Community 90 - "receipt-printer.tsx"
Cohesion: 0.21
Nodes (11): ReceiptDialog(), BARS, damp(), DEFAULT_ITEMS, haptic(), Phase, Receipt(), ReceiptItem (+3 more)

### Community 91 - "background-paths.tsx"
Cohesion: 0.22
Nodes (12): BackgroundPaths(), BackgroundPathsProps, DefaultContent(), drawLines(), EASE_OUT(), Frame, Layer, LAYERS (+4 more)

### Community 92 - "ai-rewrite.tsx"
Cohesion: 0.21
Nodes (11): AiRewrite(), run(), bare(), CopyText(), Field, FIELD_LABEL, REWRITE_FIELD, RewriteResult (+3 more)

### Community 93 - "infographics.tsx"
Cohesion: 0.29
Nodes (11): narrative(), ReportCover(), Ring(), ScoreScale(), STATIONS, STATUS_COLOR, STATUS_WORD, TONE_COLOR (+3 more)

### Community 94 - "api.ts"
Cohesion: 0.33
Nodes (4): API_URL, ApiError, EVENT_TYPES, AuditEvent

## Ambiguous Edges - Review These
- `Ira Analytics` → `Rankwise - SEO, AEO & GEO website audit`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to

## Knowledge Gaps
- **40 isolated node(s):** `@neon/env`, `axe-core`, `lucide-react`, `react`, `react-dom` (+35 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 728 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `site-header.tsx` to `site-pages.tsx`, `Root Layout & Feature Demos`, `Frontend Tooling Config`, `feedback-form.tsx`, `features/page.tsx`, `next`, `pricing/page.tsx`, `audit-view.tsx`, `auth-recovery.tsx`, `App Shell & Nav`, `lucide-react`, `UrlForm`, `monitoring.tsx`, `route.ts`, `account.tsx`, `FeedbackAdmin`, `(marketing)/page.tsx`, `billing.tsx`, `auth.ts`, `AuthForm`, `next.config.ts`, `animated-badge.tsx`, `better-auth`, `ref_react`, `ai-rewrite.tsx`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Are the 40 inferred relationships involving `Site` (e.g. with `owned_site()` and `checks_today()`) actually correct?**
  _`Site` has 40 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@neon/env`, `axe-core`, `lucide-react` to the rest of the system?**
  _40 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `billing.py` be split into smaller, more focused modules?**
  _Cohesion score 0.05016797312430011 - nodes in this community are weakly interconnected._
- **Why does `dependencies` connect `Frontend Dependencies` to `Frontend Tooling Config`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Should `Monitoring API Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.09250693802035152 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Ira Analytics` and `Rankwise - SEO, AEO & GEO website audit`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._