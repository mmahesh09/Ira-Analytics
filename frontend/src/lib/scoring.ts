/** Client mirror of backend/app/common.py scoring, used for "what if I fix this" projections. Keep in sync. */
import type { AuditReport, Check, ModuleKey } from "./types";
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
