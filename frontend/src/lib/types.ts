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
  /** how often scheduled light checks run (never more often than the plan allows) */
  audit_cadence: "off" | "daily" | "weekly";
  /** one full audit a month on the schedule, paid with a credit */
  auto_full_audit: boolean;
  tracking_key: string;
  snippet: string;
  created_at: string;
}

/* Monitoring (backend/app/routers/monitoring.py) */
export interface AuditPoint {
  id: number;
  created_at: string;
  trigger: "scheduled" | "manual" | "deploy" | string;
  kind: "full" | "deep" | "check";
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
  plan: "free" | "pro" | "business" | "scale";
  status: string | null;
  currency: "inr" | "usd" | null;
  current_end: string | null;
  cancel_at_cycle_end: boolean;
  /** a downgrade waiting for the end of the current period */
  scheduled_plan: "pro" | "business" | "scale" | null;
  entitlements: {
    sites: number;
    monthly_credits: number;
    crawl_pages: number;
    deep_audit: boolean;
    check_cadence: string;
    daily_checks: number;
    credit_packs: boolean;
    ai_rewrites: number;
  };
  payments_enabled: boolean;
  usd_enabled: boolean;
  credits: { total: number; monthly: number; pack: number; adjustment: number; monthly_expires_at: string | null };
  checks_today: number;
  /** recent full audits and what they cost: held = running, captured = charged, released = refunded */
  usage: { site: string | null; kind: "audit" | "deep_audit"; cost: number; status: "held" | "captured" | "released"; created_at: string }[];
}

/** GET /api/billing/payments; amount is in the smallest unit (paise / cents) */
export interface PaymentRow {
  id: string;
  kind: "subscription" | "pack";
  description: string | null;
  amount: number;
  currency: "inr" | "usd";
  status: "captured" | "failed" | "refunded" | string;
  paid_at: string | null;
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
