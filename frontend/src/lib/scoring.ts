/** Client mirror of backend/app/common.py scoring, used for "what if I fix this" projections. Keep in sync. */
import type { AuditReport, Check, ModuleKey, Severity } from "./types";
import { SCORED_MODULES } from "./format";

const STATUS_VALUE: Record<string, number> = { pass: 1, warn: 0.5, fail: 0 };
export const MODULE_WEIGHTS: Partial<Record<ModuleKey, number>> = { seo: 35, aeo: 20, geo: 25, performance: 20 };

export function scoreChecks(checks: Check[]): number {
  const scored = checks.filter((c) => c.status in STATUS_VALUE);
  const total = scored.reduce((s, c) => s + c.weight, 0);
  if (!total) return 0;
  return Math.round((100 * scored.reduce((s, c) => s + STATUS_VALUE[c.status] * c.weight, 0)) / total);
}

export function overallScore(scores: Partial<Record<ModuleKey, number | null>>): number {
  const parts = SCORED_MODULES.flatMap((k) => (scores[k] != null && MODULE_WEIGHTS[k] ? [[MODULE_WEIGHTS[k]!, scores[k]!] as const] : []));
  const total = parts.reduce((s, [w]) => s + w, 0);
  return total ? Math.round(parts.reduce((s, [w, v]) => s + w * v, 0) / total) : 0;
}

/** Stable id for a check across modules. */
export const fixKey = (module: ModuleKey, check: Check) => `${module}:${check.id}`;

/** Open issues ranked by how many overall points fixing each one alone is worth. */
export function rankFixes(report: AuditReport) {
  const base = project(report, new Set()).projected;
  return SCORED_MODULES.flatMap((module) =>
    (report.modules[module]?.available ? report.modules[module]!.checks : [])
      .filter((c) => c.status === "fail" || c.status === "warn")
      .map((check) => {
        const key = fixKey(module, check);
        return { key, module, check, gain: project(report, new Set([key])).projected - base };
      }),
  ).sort((a, b) => b.gain - a.gain || (a.check.status === "fail" ? -1 : 1));
}

/**
 * Module and overall scores if the given checks were fixed (status → pass).
 * Module scores move by the check-score delta so they stay consistent with what the backend reported.
 */
export function project(report: AuditReport, fixed: Set<string>) {
  const modules: Partial<Record<ModuleKey, { current: number; projected: number }>> = {};
  for (const key of SCORED_MODULES) {
    const mod = report.modules[key];
    if (!mod?.available || mod.score == null) continue;
    const after = mod.checks.map((c) => (fixed.has(fixKey(key, c)) ? { ...c, status: "pass" as const } : c));
    const delta = scoreChecks(after) - scoreChecks(mod.checks);
    modules[key] = { current: mod.score, projected: Math.max(0, Math.min(100, mod.score + delta)) };
  }
  const pick = (which: "current" | "projected") => Object.fromEntries(Object.entries(modules).map(([k, v]) => [k, v![which]]));
  return { modules, current: overallScore(pick("current")), projected: overallScore(pick("projected")) };
}

/* ---------- Smart Issue Prioritization ---------- */

export const EFFORT_LABEL: Record<1 | 2 | 3, string> = { 1: "~5 min", 2: "~1 hour", 3: "~1 day" };
export const SEVERITY_LABEL: Record<Severity, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Mirrors backend/app/priority.py `severity` for reports cached before checks carried it. */
export function severityOf(check: Check): Severity {
  if (check.severity) return check.severity;
  if (check.status === "fail" && check.weight >= 3) return "critical";
  if (check.status === "fail" || check.weight >= 3) return "high";
  return check.weight >= 2 ? "medium" : "low";
}

export type Prioritized = ReturnType<typeof rankFixes>[number] & { severity: Severity; effort: 1 | 2 | 3; confidence: number; priority: number };

/**
 * Open issues ranked by impact × confidence ÷ effort. Impact is the overall-score gain of the fix alone;
 * a floor keeps zero-gain issues (e.g. in a module that couldn't be scored) ordered by severity rather than dropped.
 */
export function prioritize(report: AuditReport): Prioritized[] {
  return rankFixes(report)
    .map((f) => {
      const effort = f.check.effort ?? 2;
      const confidence = f.check.confidence ?? 0.85;
      return { ...f, severity: severityOf(f.check), effort, confidence, priority: (Math.max(f.gain, 0.25) * confidence) / effort };
    })
    .sort((a, b) => b.priority - a.priority || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/** Running overall score as each fix in `plan` is applied in order: [start, after #1, after #2, ...]. */
export function cumulative(report: AuditReport, plan: { key: string }[]): number[] {
  const applied = new Set<string>();
  const steps = [project(report, applied).current];
  for (const f of plan) {
    applied.add(f.key);
    steps.push(project(report, applied).projected);
  }
  return steps;
}
