"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { MODULES, SCORED_MODULES } from "@/lib/format";
import { MODULE_WEIGHTS } from "@/lib/scoring";
import type { AuditReport, Check, ModuleKey } from "@/lib/types";

const VALUE: Record<string, number> = { pass: 1, warn: 0.5, fail: 0 };

/** Transparent Health Score: how module scores roll up, and which checks cost the most points. */
export function ScoreBreakdown({ report }: { report: AuditReport }) {
  const [open, setOpen] = useState(false);
  const rows = SCORED_MODULES.map((key) => {
    const mod = report.modules[key];
    return { key, weight: MODULE_WEIGHTS[key] ?? 0, score: mod?.available ? mod.score : null };
  });
  const counted = rows.filter((r) => r.score != null);
  const totalWeight = counted.reduce((s, r) => s + r.weight, 0);

  // points each failing/warning check removes from the OVERALL score
  const deductions = counted
    .flatMap(({ key, weight }) => {
      const checks = (report.modules[key]?.checks ?? []).filter((c) => c.status in VALUE);
      const moduleWeight = checks.reduce((s, c) => s + c.weight, 0) || 1;
      return checks
        .filter((c) => c.status !== "pass")
        .map((c: Check) => ({ key, check: c, points: ((weight / totalWeight) * 100 * c.weight * (1 - VALUE[c.status])) / moduleWeight }));
    })
    .sort((a, b) => b.points - a.points)
    .slice(0, 8);
  const a11y = report.modules.accessibility;

  return (
    <section aria-labelledby="breakdown-title" className="panel rounded-xl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="breakdown-body"
        className="flex w-full cursor-pointer items-center justify-between gap-4 p-6 text-left"
      >
        <span>
          <span id="breakdown-title" className="block text-[17px] font-medium tracking-[-0.01em]">
            How your score is built
          </span>
          <span className="mt-1 block text-[14px] text-ink-3">Every point traced to a module and a check. No black box.</span>
        </span>
        <ChevronDown aria-hidden="true" className={`size-5 shrink-0 text-ink-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div id="breakdown-body" className="grid gap-8 border-t border-line p-6 lg:grid-cols-2">
          <div>
            <p className="font-sub text-[12.5px] text-ink-3">Module weights</p>
            <table className="mt-3 w-full font-sub text-[13.5px]">
              <thead className="text-left text-[12px] text-ink-3">
                <tr>
                  <th className="pb-2 font-normal">Module</th>
                  <th className="pb-2 text-right font-normal">Weight</th>
                  <th className="pb-2 text-right font-normal">Score</th>
                  <th className="pb-2 text-right font-normal">Adds</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td className="py-2.5 text-ink">{MODULES[r.key as ModuleKey].label}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink-3">{r.score == null ? <s>{r.weight}%</s> : `${Math.round((r.weight / totalWeight) * 100)}%`}</td>
                    <td className="py-2.5 text-right tabular-nums">{r.score ?? "n/a"}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink-2">{r.score == null ? "—" : ((r.weight / totalWeight) * r.score).toFixed(1)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="pt-3 font-medium text-ink">Overall</td>
                  <td />
                  <td />
                  <td className="pt-3 text-right font-semibold tabular-nums text-ink">{report.overall_score}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-4 text-[12.5px] leading-relaxed text-ink-3">
              Modules that couldn&apos;t run are left out and the rest re-weighted. Each check scores pass = full, needs work = half, critical = zero, weighted by impact.
              {a11y?.available && ` Accessibility (${a11y.score}) is reported separately and not yet part of the overall score.`}
            </p>
          </div>
          <div>
            <p className="font-sub text-[12.5px] text-ink-3">Biggest deductions</p>
            <ol className="mt-3 space-y-2">
              {deductions.map(({ key, check, points }) => (
                <li key={`${key}-${check.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] text-ink-2">{check.title}</span>
                    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <span className={`block h-1 rounded-full ${check.status === "fail" ? "bg-bad" : "bg-warn"}`} style={{ width: `${Math.min(100, (points / (deductions[0]?.points || 1)) * 100)}%` }} />
                    </span>
                  </span>
                  <span className="font-sub text-[12.5px] tabular-nums text-ink-3">−{points.toFixed(1)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
