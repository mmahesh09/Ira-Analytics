export type Status = "pass" | "warn" | "fail" | "info";
export type ModuleKey = "seo" | "aeo" | "geo" | "performance" | "accessibility" | "traffic";

export type Severity = "critical" | "high" | "medium" | "low";

/** Ready-to-paste code for a fix (One-Click Fix Suggestions). */
export interface Snippet {
  lang: "html" | "json" | "text" | "markdown" | "xml";
  file: string;
  code: string;
}

export interface Check {
  id: string;
  title: string;
  status: Status;
  weight: number;
  detail: string;
  fix: string | null;
  /* Smart Issue Prioritization; absent on reports cached before it shipped */
  severity?: Severity | null;
  effort?: 1 | 2 | 3 | null;
  confidence?: number | null;
  snippet?: Snippet | null;
}

export interface ModuleResult {
  key: ModuleKey;
  available: boolean;
  score: number | null;
  summary: string;
  checks: Check[];
  // Module-specific payloads; narrowed by the panel that renders them.
  data: Record<string, unknown>;
}

export interface AuditReport {
  url: string;
  final_url: string;
  domain: string;
  fetched_at: string;
  overall_score: number;
  modules: Partial<Record<ModuleKey, ModuleResult>>;
}

export type AuditEvent =
  | { type: "stage"; stage: "fetch"; status: "running" | "done" }
  | { type: "module"; module: ModuleResult }
  | { type: "warning"; message: string }
  | { type: "result"; report: AuditReport; cached?: boolean }
  | { type: "error"; message: string };

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Site {
  id: number;
  domain: string;
  name: string;
  timezone: string;
  audit_cadence: "off" | "daily" | "weekly";
  tracking_key: string;
  snippet: string;
  created_at: string;
}

/* Monitoring (backend/app/routers/monitoring.py) */
export interface AuditPoint {
  id: number;
  created_at: string;
  trigger: "scheduled" | "manual" | "deploy" | string;
  overall: number;
  seo: number | null;
  aeo: number | null;
  geo: number | null;
  speed: number | null;
}

export interface IssueRow {
  id: number;
  module: ModuleKey;
  title: string;
  severity: "fail" | "warn";
  status: "open" | "resolved";
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  effort: 1 | 2 | 3;
  confidence: number;
}

/** GET /api/sites/{id}/verifications: Before-and-After Verification */
export interface VerificationRow {
  id: number;
  issue_id: number;
  title: string;
  module: ModuleKey;
  status: "queued" | "fixed" | "still_failing" | "unmeasured";
  check_status: string | null;
  before_overall: number | null;
  after_overall: number | null;
  before_module: number | null;
  after_module: number | null;
  requested_at: string;
  finished_at: string | null;
}

export interface LinkRow {
  url: string;
  source_url: string;
  internal: boolean;
  ok: boolean;
  status_code: number | null;
  error: string | null;
  first_broken_at: string | null;
  last_checked_at: string;
}

export interface SiteStatus {
  running: string[];
  queued: string[];
  last_audit_at: string | null;
  next_audit_at: string | null;
}

export interface AlertRow {
  id: number;
  site_id: number;
  site_name: string;
  kind: "regression" | "new_issue" | "broken_links" | string;
  message: string;
  read: boolean;
  created_at: string;
}

/** GET /api/billing (backend/app/routers/billing.py BillingOut) */
export interface Billing {
  plan: "free" | "pro" | "business";
  status: string | null;
  currency: "inr" | "usd" | null;
  current_end: string | null;
  cancel_at_cycle_end: boolean;
  entitlements: { sites: number; pageviews: number; audit_cadence: string; ai_prompts: number; competitors: number; retention_months: number; google_integrations: boolean };
  payments_enabled: boolean;
  usd_enabled: boolean;
}

export interface Crawler {
  bot: string;
  owner: string;
  allowed: boolean;
}

export interface Probe {
  model: string;
  prompt: string;
  mentioned?: boolean;
  cited?: boolean;
  excerpt?: string;
  error?: string;
}

export interface LabMetric {
  id: string;
  label: string;
  value: number;
  display: string;
  status: Status;
  unit: string;
  good: number;
  poor: number;
}

export interface KeywordRow {
  keyword: string | null;
  volume: number | null;
  position: number | null;
  url: string | null;
  etv: number | null;
}
