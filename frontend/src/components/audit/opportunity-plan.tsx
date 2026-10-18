"use client";

import { useMemo } from "react";
import { Compass } from "lucide-react";
import { MODULES } from "@/lib/format";
import { EFFORT_LABEL, cumulative, prioritize, type Prioritized } from "@/lib/scoring";
import type { AuditReport } from "@/lib/types";

function Group({ title, note, items }: { title: string; note: string; items: Prioritized[] }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.015] p-4">
      <p className="eyebrow text-[10.5px]">{title}</p>
      <p className="mt-1 font-sub text-[12.5px] text-ink-3">{note}</p>
      {items.length ? (
        <ul className="mt-3 space-y-2">
          {items.map((f) => (
            <li key={f.key} className="flex items-baseline justify-between gap-3 text-[14px]">
              <span className="min-w-0 truncate text-ink-2">{f.check.title}</span>
              {f.gain > 0 && <span className="shrink-0 font-mono text-[12px] text-good">+{f.gain}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 font-sub text-[13px] text-ink-3">None on this page.</p>
      )}
    </div>
  );
}

/** Website Opportunity Finder: the best fixes in order, with the overall score after each one. */
export function OpportunityPlan({ report }: { report: AuditReport }) {
  const { plan, steps, quick, big } = useMemo(() => {
    const ranked = prioritize(report);
    const plan = ranked.filter((f) => f.gain > 0).slice(0, 5);
    return {
      plan,
      steps: cumulative(report, plan),
      quick: ranked.filter((f) => f.effort === 1).slice(0, 4),
      big: ranked.filter((f) => f.effort === 3).slice(0, 4),
    };
  }, [report]);

  if (!plan.length) return null;
  const start = steps[0];
  const end = steps.at(-1)!;

  return (
    <section aria-labelledby="opp-title" className="panel rounded-xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2 text-[11px]">
            <Compass aria-hidden="true" className="size-3.5 text-cobalt" /> Opportunity finder
          </p>
          <h2 id="opp-title" className="mt-2 text-[22px] font-semibold tracking-[-0.025em]">
            Biggest wins, in the order to do them
          </h2>
          <p className="mt-1 text-[14px] text-ink-3">Ranked by points gained, how sure we are it matters, and how long it takes.</p>
        </div>
        <p className="font-display text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums" aria-label={`Score goes from ${start} to ${end}`}>
          <span className="text-ink-3">{start}</span> <span className="text-[22px] text-ink-3">→</span> <span className="text-good">{end}</span>
        </p>
      </div>

      <ol className="mt-6 space-y-2">
        {plan.map((f, i) => (
          <li key={f.key} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-lg border border-line bg-white/[0.015] px-3 py-2.5 sm:grid-cols-[28px_minmax(0,1fr)_auto_140px]">
            <span className="font-code text-[12px] text-cobalt">{String(i + 1).padStart(2, "0")}</span>
            <span className="min-w-0">
              <span className="block truncate text-[14.5px] text-ink">{f.check.title}</span>
              <span className="font-sub text-[12px] text-ink-3">
                {MODULES[f.module].label} · {EFFORT_LABEL[f.effort]}
              </span>
            </span>
            <span className="font-mono text-[13px] font-medium text-good">+{f.gain}</span>
            {/* running score after this step */}
            <span className="col-span-3 flex items-center gap-2 sm:col-span-1">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <span className="block h-full rounded-full bg-cobalt" style={{ width: `${steps[i + 1]}%` }} />
              </span>
              <span className="w-7 text-right font-mono text-[12.5px] text-ink-2">{steps[i + 1]}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Group title="Quick wins" note="About five minutes each: paste a tag or a file." items={quick} />
        <Group title="Bigger projects" note="A day or more: content or engineering work." items={big} />
      </div>
    </section>
  );
}
