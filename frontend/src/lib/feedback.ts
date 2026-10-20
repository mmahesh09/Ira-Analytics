/** Product feedback: option lists, form state, validation and API calls. The backend (app/models.py FeedbackIn) checks the same rules. */

import { apiFetch } from "./api";

export type Option<V extends string = string> = { value: V; label: string };

export const ROLES = [
  { value: "founder", label: "Founder" },
  { value: "seo_specialist", label: "SEO Specialist" },
  { value: "marketing_manager", label: "Marketing Manager" },
  { value: "agency_owner", label: "Agency Owner" },
  { value: "content_writer", label: "Content Writer" },
  { value: "developer", label: "Developer" },
  { value: "other", label: "Other" },
] as const satisfies readonly Option[];

export const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "several_weekly", label: "Several times a week" },
  { value: "weekly", label: "Weekly" },
  { value: "occasionally", label: "Occasionally" },
  { value: "first_time", label: "First time using Rankwise" },
] as const satisfies readonly Option[];

export const GOALS = [
  { value: "ai_visibility", label: "Improve AI search visibility" },
  { value: "brand_mentions", label: "Track brand mentions and AI citations" },
  { value: "content_opportunities", label: "Discover content opportunities" },
  { value: "ai_content", label: "Create AI-optimized content" },
  { value: "technical_seo", label: "Fix technical SEO issues" },
  { value: "publishing", label: "Publish content to a website" },
  { value: "performance_monitoring", label: "Monitor search performance" },
  { value: "other", label: "Other" },
] as const satisfies readonly Option[];

export const FEATURES = [
  { value: "visibility_audit", label: "AI visibility audit" },
  { value: "citation_tracking", label: "AI citation tracking" },
  { value: "scorecard", label: "Visibility scorecard" },
  { value: "content_planning", label: "Content planning" },
  { value: "ai_articles", label: "AI-assisted article creation" },
  { value: "technical_seo", label: "Technical SEO recommendations" },
  { value: "cms_publishing", label: "CMS integrations and publishing" },
  { value: "performance_reporting", label: "Performance reporting" },
  { value: "none_yet", label: "None yet" },
] as const satisfies readonly Option[];

export const CHALLENGES = [
  { value: "hard_to_understand", label: "Difficult to understand results" },
  { value: "missing_features", label: "Missing features" },
  { value: "inaccurate_data", label: "Inaccurate or incomplete data" },
  { value: "weak_recommendations", label: "Recommendations need improvement" },
  { value: "confusing_setup", label: "Technical setup is confusing" },
  { value: "integration_issues", label: "Integrations or publishing issues" },
  { value: "slow_performance", label: "Slow performance" },
  { value: "pricing", label: "Pricing concerns" },
  { value: "no_issues", label: "No major issues" },
  { value: "other", label: "Other" },
] as const satisfies readonly Option[];

export type Role = (typeof ROLES)[number]["value"];
export type Frequency = (typeof FREQUENCIES)[number]["value"];
export type Goal = (typeof GOALS)[number]["value"];
export type Feature = (typeof FEATURES)[number]["value"];
export type Challenge = (typeof CHALLENGES)[number]["value"];

const LABELS: Record<string, string> = Object.fromEntries(
  [...ROLES, ...FREQUENCIES, ...GOALS, ...FEATURES, ...CHALLENGES].map((o) => [o.value, o.label]),
);
/** Display label for a stored option value (features and goals share a few values, with the same meaning). */
export const labelOf = (value: string | null | undefined) => (value ? (LABELS[value] ?? value) : "—");

export const LONG_TEXT = 2000;
export const SHORT_TEXT = 120;

export interface FeedbackForm {
  name: string;
  email: string;
  role: Role | "";
  role_other: string;
  usage_frequency: Frequency | "";
  satisfaction_rating: number | null;
  usability_rating: number | null;
  recommendation_score: number | null;
  primary_goal: Goal | "";
  primary_goal_other: string;
  features_used: Feature[];
  most_valuable_feature: Feature | "";
  biggest_challenge: Challenge | "";
  biggest_challenge_other: string;
  positive_feedback: string;
  improvement_suggestions: string;
  requested_feature: string;
  additional_comments: string;
  contact_permission: boolean;
}

export const EMPTY_FORM: FeedbackForm = {
  name: "",
  email: "",
  role: "",
  role_other: "",
  usage_frequency: "",
  satisfaction_rating: null,
  usability_rating: null,
  recommendation_score: null,
  primary_goal: "",
  primary_goal_other: "",
  features_used: [],
  most_valuable_feature: "",
  biggest_challenge: "",
  biggest_challenge_other: "",
  positive_feedback: "",
  improvement_suggestions: "",
  requested_feature: "",
  additional_comments: "",
  contact_permission: false,
};

export type Errors = Partial<Record<keyof FeedbackForm, string>>;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const inRange = (v: number | null, min: number, max: number) => v !== null && Number.isInteger(v) && v >= min && v <= max;

/** Errors for one step (0-2), in the order the fields appear, so the first key is the first invalid field. */
export function validateStep(step: number, f: FeedbackForm): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (f.name.length > SHORT_TEXT) e.name = `Keep your name under ${SHORT_TEXT} characters.`;
    if (f.email.trim() && !EMAIL.test(f.email.trim())) e.email = "Enter a valid email address, or leave it blank.";
    if (!f.role) e.role = "Choose the role that fits you best.";
    else if (f.role === "other" && !f.role_other.trim()) e.role_other = "Tell us your role.";
    if (!f.usage_frequency) e.usage_frequency = "Choose how often you use Rankwise.";
  }
  if (step === 1) {
    if (!inRange(f.satisfaction_rating, 1, 5)) e.satisfaction_rating = "Rate your overall satisfaction from 1 to 5.";
    if (!inRange(f.usability_rating, 1, 5)) e.usability_rating = "Rate how easy Rankwise is to use from 1 to 5.";
    if (!inRange(f.recommendation_score, 0, 10)) e.recommendation_score = "Pick a score from 0 to 10.";
    if (!f.primary_goal) e.primary_goal = "Choose your main goal.";
    else if (f.primary_goal === "other" && !f.primary_goal_other.trim()) e.primary_goal_other = "Tell us your main goal.";
    if (!f.biggest_challenge) e.biggest_challenge = "Choose your biggest challenge, or “No major issues”.";
    else if (f.biggest_challenge === "other" && !f.biggest_challenge_other.trim()) e.biggest_challenge_other = "Tell us your biggest challenge.";
  }
  if (step === 2) {
    for (const key of ["positive_feedback", "improvement_suggestions", "requested_feature", "additional_comments"] as const) {
      if (f[key].length > LONG_TEXT) e[key] = `Keep this under ${LONG_TEXT} characters.`;
    }
  }
  return e;
}

const blank = (v: string) => v.trim() || null;

/** The JSON body for POST /api/feedback. Text typed under "Other" is only sent while Other is selected. */
export function toPayload(f: FeedbackForm, submissionId: string) {
  const email = blank(f.email);
  return {
    submission_id: submissionId,
    name: blank(f.name),
    email,
    role: f.role,
    role_other: f.role === "other" ? blank(f.role_other) : null,
    usage_frequency: f.usage_frequency,
    satisfaction_rating: f.satisfaction_rating,
    usability_rating: f.usability_rating,
    recommendation_score: f.recommendation_score,
    primary_goal: f.primary_goal,
    primary_goal_other: f.primary_goal === "other" ? blank(f.primary_goal_other) : null,
    features_used: f.features_used,
    most_valuable_feature: f.most_valuable_feature || null,
    biggest_challenge: f.biggest_challenge,
    biggest_challenge_other: f.biggest_challenge === "other" ? blank(f.biggest_challenge_other) : null,
    positive_feedback: blank(f.positive_feedback),
    improvement_suggestions: blank(f.improvement_suggestions),
    requested_feature: blank(f.requested_feature),
    additional_comments: blank(f.additional_comments),
    contact_permission: Boolean(email) && f.contact_permission,
  };
}

export function submitFeedback(f: FeedbackForm, submissionId: string) {
  return apiFetch<{ ok: true }>("/feedback", { method: "POST", body: toPayload(f, submissionId) });
}

// ---------- admin ----------

export interface FeedbackRow {
  id: number;
  created_at: string;
  name: string | null;
  email: string | null;
  role: Role;
  role_other: string | null;
  usage_frequency: Frequency;
  satisfaction_rating: number;
  usability_rating: number;
  recommendation_score: number;
  primary_goal: Goal;
  primary_goal_other: string | null;
  features_used: Feature[];
  most_valuable_feature: Feature | null;
  biggest_challenge: Challenge;
  biggest_challenge_other: string | null;
  positive_feedback: string | null;
  improvement_suggestions: string | null;
  requested_feature: string | null;
  additional_comments: string | null;
  contact_permission: boolean;
}

export interface FeedbackPage {
  items: FeedbackRow[];
  total: number;
  page: number;
  page_size: number;
}

export type Count = { value: string; count: number };

export interface FeedbackStats {
  total: number;
  avg_satisfaction: number | null;
  avg_usability: number | null;
  avg_recommendation: number | null;
  nps: number | null;
  feature_requests: number;
  trend: { date: string; count: number }[];
  top_challenges: Count[];
  top_valued_features: Count[];
  features_used: Count[];
  recent_requests: { id: number; text: string; created_at: string }[];
}

export interface AdminFilters {
  q: string;
  date_from: string;
  date_to: string;
  role: Role | "";
  min_rating: string;
  feature: Feature | "";
}

export const EMPTY_FILTERS: AdminFilters = { q: "", date_from: "", date_to: "", role: "", min_rating: "", feature: "" };

export type SortKey = "created_at" | "satisfaction_rating" | "usability_rating" | "recommendation_score";

/** Query string for the admin endpoints; empty filters are left out. */
export function filterQuery(f: AdminFilters, extra: Record<string, string | number> = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra })) {
    const value = String(v).trim();
    if (value) params.set(k, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const getFeedbackStats = (f: AdminFilters) => apiFetch<FeedbackStats>(`/admin/feedback/stats${filterQuery(f)}`);
export const listFeedback = (f: AdminFilters, page: number, sort: SortKey, order: "asc" | "desc") =>
  apiFetch<FeedbackPage>(`/admin/feedback${filterQuery(f, { page, page_size: 20, sort, order })}`);
export const exportUrl = (f: AdminFilters) => `/api/admin/feedback/export.csv${filterQuery(f)}`;
