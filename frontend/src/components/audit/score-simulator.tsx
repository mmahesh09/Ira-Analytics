"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { MODULES, SCORED_MODULES } from "@/lib/format";
import { project, rankFixes } from "@/lib/scoring";
import type { AuditReport, Check as CheckT, ModuleKey } from "@/lib/types";
import { ProjectionBars, ScoreGauge } from "./charts";

type Candidate = { key: string; module: ModuleKey; check: CheckT; gain: number };

/** "What if I fix these?": tick issues and watch the module and overall scores move. */
export function ScoreSimulator({ report }: { report: AuditReport }) {
  const [fixed, setFixed] = useState<Set<string>>(new Set());

  const candidates = useMemo<Candidate[]>(() => rankFixes(report), [report]);

  const result = useMemo(() => project(report, fixed), [report, fixed]);
  const bars = SCORED_MODULES.flatMap((k) => (result.modules[k] ? [{ module: MODULES[k].label, ...result.modules[k]! }] : []));
  const gain = result.projected - result.current;

  function toggle(key: string) {
    setFixed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (!candidates.length) return null;

  return (
    <section aria-labelledby="sim-title" className="panel rounded-xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="sim-title" className="flex items-center gap-2 text-[17px] font-medium tracking-[-0.01em]">
            <Sparkles aria-hidden="true" className="size-4 text-ink-3" /> Fix simulator
          </h2>
          <p className="mt-1 text-[14px] text-ink-3">Tick the issues you plan to fix and see how far your score moves.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFixed(new Set(candidates.slice(0, 5).map((c) => c.key)))}
            className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-ink px-3 font-sub text-[13px] font-medium text-paper transition-colors hover:bg-white"
          >
            Pick the top 5
          </button>
          <button
            type="button"
            onClick={() => setFixed(new Set())}
            disabled={!fixed.size}
            className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-white/[0.12] px-3 font-sub text-[13px] text-ink-2 transition-colors hover:bg-white/[0.05] disabled:cursor-default disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div>
          <div className="flex items-center justify-center gap-4 sm:gap-6" aria-live="polite">
            <div className="text-center">
              <ScoreGauge score={result.current} size={104} label="Score now" />
              <p className="mt-1 font-sub text-[12.5px] text-ink-3">Now</p>
            </div>
            <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-ink-3" />
            <div className="text-center">
              <ScoreGauge score={result.projected} size={104} label="Score after selected fixes" />
              <p className="mt-1 font-sub text-[12.5px] text-ink-3">After fixes</p>
            </div>
            <div className="min-w-[72px]">
              <p className={`font-display text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums ${gain > 0 ? "text-good" : "text-ink-3"}`}>
                {gain > 0 ? `+${gain}` : "±0"}
              </p>
              <p className="mt-1 font-sub text-[12px] text-ink-3">
                {fixed.size} fix{fixed.size === 1 ? "" : "es"} selected
              </p>
            </div>
          </div>
          <div className="mt-6">
            <ProjectionBars data={bars} />
          </div>
        </div>

        <fieldset className="min-w-0">
          <legend className="sr-only">Issues to fix</legend>
          <ul className="max-h-[380px] space-y-1.5 overflow-y-auto pr-1">
            {candidates.map((c) => {
              const on = fixed.has(c.key);
              return (
                <li key={c.key}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${on ? "border-white/20 bg-white/[0.06]" : "border-white/[0.06] hover:bg-white/[0.03]"}`}
                  >
                    <input type="checkbox" checked={on} onChange={() => toggle(c.key)} className="peer sr-only" />
                    <span
                      aria-hidden="true"
                      className={`grid size-4 shrink-0 place-items-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-white/40 ${on ? "border-ink bg-ink text-paper" : "border-white/25"}`}
                    >
                      {on && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className={`size-1.5 shrink-0 rounded-full ${c.check.status === "fail" ? "bg-bad" : "bg-warn"}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate font-sub text-[13.5px] text-ink-2">{c.check.title}</span>
                    <span className="shrink-0 rounded border border-white/[0.08] px-1.5 py-0.5 font-sub text-[11px] text-ink-3">{MODULES[c.module].label}</span>
                    <span className={`w-9 shrink-0 text-right font-sub text-[12.5px] tabular-nums ${c.gain > 0 ? "text-good" : "text-ink-3"}`}>{c.gain > 0 ? `+${c.gain}` : "<1"}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 font-sub text-[12px] text-ink-3">Points are estimates for the overall score, using the same weights as the report.</p>
        </fieldset>
      </div>
    </section>
  );
}
