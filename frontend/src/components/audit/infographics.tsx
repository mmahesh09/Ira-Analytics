"use client";

import type { CSSProperties } from "react";
import { Bot, Gauge, MessageSquareQuote, Search, type LucideIcon } from "lucide-react";
import { MODULES, SCORED_MODULES, TONE_LABEL, scoreTone } from "@/lib/format";
import type { AuditReport, Check, ModuleKey } from "@/lib/types";
import { COLOR, VisibilityRadar, type Severity } from "./charts";

const TONE_COLOR = { good: COLOR.good, warn: COLOR.warn, bad: COLOR.bad } as const;
const STATUS_COLOR: Record<string, string> = { pass: COLOR.good, warn: COLOR.warn, fail: COLOR.bad };
const STATUS_WORD: Record<string, string> = { pass: "Passed", warn: "Improve", fail: "Critical" };

/* ---------- 1. Report cover: oversized score, narrative, score scale ---------- */

/** One honest sentence built from the scores. */
function narrative(report: AuditReport, potential: number, fixCount: number): string {
  const scored = SCORED_MODULES.flatMap((k) => (report.modules[k]?.available && report.modules[k]!.score != null ? [{ k, s: report.modules[k]!.score! }] : []));
  if (!scored.length) return "We couldn't score this page.";
  const best = scored.reduce((a, b) => (b.s > a.s ? b : a));
  const worst = scored.reduce((a, b) => (b.s < a.s ? b : a));
  const parts: string[] = [];
  if (best.k !== worst.k) parts.push(`${scoreTone(best.s) === "good" ? "Strong" : "Best"} on ${MODULES[best.k].label}, ${scoreTone(worst.s) === "bad" ? "weak" : "softer"} on ${MODULES[worst.k].label}.`);
  if (potential > report.overall_score) parts.push(`Fixing ${fixCount} issue${fixCount === 1 ? "" : "s"} could lift you to ${potential}.`);
  else parts.push("Nothing left that moves the score much.");
  return parts.join(" ");
}

/** 0–100 ruler with Poor / Needs work / Strong zones, a pin for today and a ghost pin for what's achievable. */
export function ScoreScale({ score, potential }: { score: number; potential?: number }) {
  const zones = [
    { from: 0, to: 50, label: "Poor", color: COLOR.bad },
    { from: 50, to: 80, label: "Needs work", color: COLOR.warn },
    { from: 80, to: 100, label: "Strong", color: COLOR.good },
  ];
  const pin = (value: number, ghost = false) => (
    <div className="absolute top-0 -translate-x-1/2" style={{ left: `${value}%` }}>
      <div className={`mx-auto h-[22px] w-[2px] rounded-full ${ghost ? "bg-white/40" : "bg-ink"}`} style={ghost ? { background: "repeating-linear-gradient(to bottom, rgba(255,255,255,0.55) 0 3px, transparent 3px 6px)" } : undefined} />
      <div className={`mt-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 font-sub text-[11.5px] tabular-nums ${ghost ? "border border-dashed border-white/25 text-ink-2" : "bg-ink font-medium text-paper"}`}>
        {ghost ? `${value} possible` : `${value} today`}
      </div>
    </div>
  );
  return (
    <div className="relative pb-10 pt-1" role="img" aria-label={`Score ${score} of 100${potential && potential > score ? `, ${potential} achievable` : ""}`}>
      <div className="relative mt-[7px] flex h-2 overflow-hidden rounded-full">
        {zones.map((z) => (
          <span key={z.label} style={{ width: `${z.to - z.from}%`, background: z.color, opacity: 0.28 }} />
        ))}
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${score}%`, background: TONE_COLOR[scoreTone(score)] }} />
      </div>
      <div className="absolute inset-x-0 top-[-7px]">
        {potential != null && potential > score && pin(potential, true)}
        {pin(score)}
      </div>
      <div className="mt-[34px] flex font-sub text-[11px] text-ink-3">
        {zones.map((z) => (
          <span key={z.label} style={{ width: `${z.to - z.from}%` }} className="truncate border-l border-white/10 pl-1.5">
            {z.from}
            <span className="hidden sm:inline"> · {z.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function ReportCover({ report, host, potential, fixCount, onOpen }: { report: AuditReport; host: string; potential: number; fixCount: number; onOpen: (k: ModuleKey) => void }) {
  const tone = scoreTone(report.overall_score);
  const all = SCORED_MODULES.flatMap((k) => (report.modules[k]?.available ? report.modules[k]!.checks : []));
  const passed = all.filter((c) => c.status === "pass").length;
  const critical = all.filter((c) => c.status === "fail").length;
  const radar = SCORED_MODULES.flatMap((key) => {
    const mod = report.modules[key];
    return mod?.available && mod.score != null ? [{ key, module: MODULES[key].label, score: mod.score }] : [];
  });

  return (
    <section aria-labelledby="cover-title" className="panel relative overflow-hidden rounded-xl">
      <div aria-hidden="true" className="grid-bg absolute inset-0 opacity-50" />
      <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="font-sub text-[12.5px] text-ink-3">Visibility report · {host}</p>
          <div className="mt-3 flex items-end gap-4">
            <p id="cover-title" className="font-display text-[clamp(4.5rem,9vw,7rem)] font-semibold leading-[0.85] tracking-[-0.045em] tabular-nums" style={{ color: TONE_COLOR[tone] }}>
              {report.overall_score}
            </p>
            <div className="pb-2">
              <p className="font-sub text-[13px] text-ink-3">out of 100</p>
              <p className="text-[22px] font-semibold tracking-[-0.025em]" style={{ color: TONE_COLOR[tone] }}>
                {TONE_LABEL[tone]}
              </p>
            </div>
          </div>
          <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-ink-2">{narrative(report, potential, fixCount)}</p>

          <div className="mt-7">
            <ScoreScale score={report.overall_score} potential={potential} />
          </div>

          <dl className="mt-2 grid grid-cols-3 border-t border-line pt-5">
            {[
              [`${all.length ? Math.round((passed / all.length) * 100) : 0}%`, "checks passed"],
              [String(critical), critical === 1 ? "critical issue" : "critical issues"],
              [potential > report.overall_score ? `+${potential - report.overall_score}` : "0", "points available"],
            ].map(([v, l], i) => (
              <div key={l} className={i ? "border-l border-line pl-4" : ""}>
                <dd className="font-display text-[26px] font-semibold tracking-[-0.03em] tabular-nums">{v}</dd>
                <dt className="font-sub text-[12px] text-ink-3">{l}</dt>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-col justify-center border-line lg:border-l lg:pl-8">
          <p className="font-sub text-[12.5px] text-ink-3">Shape of your visibility</p>
          {radar.length >= 3 ? (
            <VisibilityRadar data={radar} onSelect={(k) => onOpen(k as ModuleKey)} />
          ) : (
            <p className="mt-6 font-sub text-[13.5px] text-ink-3">Needs at least three scored modules to draw.</p>
          )}
          <p className="text-center font-sub text-[11.5px] text-ink-3">Dashed ring = strong (80). Click a module to open it.</p>
        </div>
      </div>
    </section>
  );
}

/* ---------- 2. Visibility journey: four places people find you ---------- */

const STATIONS: { key: ModuleKey; icon: LucideIcon; place: string }[] = [
  { key: "seo", icon: Search, place: "Google results" },
  { key: "aeo", icon: MessageSquareQuote, place: "Answer boxes" },
  { key: "geo", icon: Bot, place: "AI assistants" },
  { key: "performance", icon: Gauge, place: "Page speed" },
];

/** Icon inside a conic progress ring showing the module score. */
function Ring({ score, icon: Icon }: { score: number | null; icon: LucideIcon }) {
  const color = score != null ? TONE_COLOR[scoreTone(score)] : "rgba(255,255,255,0.15)";
  const style = { "--p": `${score ?? 0}%`, background: `conic-gradient(${color} var(--p), rgba(255,255,255,0.07) 0)` } as CSSProperties;
  return (
    <div className="relative grid size-[72px] place-items-center rounded-full" style={style}>
      <div className="grid size-[62px] place-items-center rounded-full bg-[#0d0e0f]">
        <Icon aria-hidden="true" className="size-6" style={{ color: score != null ? color : "var(--ink-3)" }} />
      </div>
    </div>
  );
}

export function VisibilityJourney({ report, onOpen }: { report: AuditReport; onOpen: (k: ModuleKey) => void }) {
  return (
    <section aria-labelledby="journey-title" className="panel rounded-xl p-6 sm:p-8">
      <h2 id="journey-title" className="text-[17px] font-medium tracking-[-0.01em]">
        How each engine sees you
      </h2>
      <p className="mt-1 text-[14px] text-ink-3">The four places people find a website today, from classic search to AI answers.</p>

      <ol className="relative mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {/* connector behind the rings (desktop) */}
        <span aria-hidden="true" className="absolute left-[12.5%] right-[12.5%] top-9 hidden h-px bg-gradient-to-r from-white/5 via-white/20 to-white/5 lg:block" />
        {STATIONS.map(({ key, icon, place }, i) => {
          const mod = report.modules[key];
          const score = mod?.available && mod.score != null ? mod.score : null;
          const tone = score != null ? scoreTone(score) : null;
          const open = (mod?.checks ?? []).filter((c) => c.status !== "pass" && c.status !== "info").length;
          return (
            <li key={key} className="relative">
              <button type="button" onClick={() => onOpen(key)} className="group flex w-full cursor-pointer flex-col items-center rounded-xl p-3 text-center transition-colors hover:bg-white/[0.03]">
                <Ring score={score} icon={icon} />
                <span className="mt-4 font-sub text-[12px] text-ink-3">
                  0{i + 1} · {MODULES[key].label}
                </span>
                <span className="mt-0.5 text-[16px] font-medium tracking-[-0.01em]">{place}</span>
                <span className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-display text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums" style={{ color: tone ? TONE_COLOR[tone] : undefined }}>
                    {score ?? "—"}
                  </span>
                  {tone && <span className="font-sub text-[12.5px]" style={{ color: TONE_COLOR[tone] }}>{TONE_LABEL[tone]}</span>}
                </span>
                <span className="mt-1.5 font-sub text-[12px] text-ink-3 group-hover:text-ink-2">{score == null ? "Not measured" : open ? `${open} to fix →` : "All passing →"}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ---------- 3. Waffle: every check at a glance ---------- */

export function CheckWaffle({ report, onOpen }: { report: AuditReport; onOpen: (k: ModuleKey, status: Severity) => void }) {
  const rows = SCORED_MODULES.flatMap((k) => (report.modules[k]?.available ? [{ k, checks: report.modules[k]!.checks.filter((c) => c.status !== "info") }] : []));
  const order: Record<string, number> = { fail: 0, warn: 1, pass: 2 };
  return (
    <div>
      <ul className="space-y-3.5">
        {rows.map(({ k, checks }) => (
          <li key={k} className="grid grid-cols-[48px_1fr] items-center gap-3">
            <span className="font-sub text-[12px] text-ink-3">{MODULES[k].label}</span>
            <span className="flex flex-wrap gap-[3px]">
              {[...checks]
                .sort((a, b) => order[a.status] - order[b.status])
                .map((c: Check) => (
                  <button
                    key={c.id}
                    type="button"
                    title={`${STATUS_WORD[c.status]}: ${c.title}`}
                    aria-label={`${MODULES[k].label}, ${STATUS_WORD[c.status]}: ${c.title}`}
                    onClick={() => onOpen(k, c.status as Severity)}
                    className="size-[13px] cursor-pointer rounded-[3px] transition-transform duration-150 hover:scale-125 focus-visible:scale-125"
                    style={{ background: STATUS_COLOR[c.status], opacity: c.status === "pass" ? 0.7 : 1 }}
                  />
                ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-sub text-[11.5px] text-ink-3">
        {(["fail", "warn", "pass"] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-[2px]" style={{ background: STATUS_COLOR[s] }} /> {STATUS_WORD[s]}
          </span>
        ))}
        <span>· one square per check</span>
      </p>
    </div>
  );
}

/* ---------- 4. Length meter (SEO title / description) ---------- */

/** Bar from 0 to `max` characters with the ideal range highlighted and a marker at the current length. */
export function LengthMeter({ label, length, ideal, max }: { label: string; length: number; ideal: [number, number]; max: number }) {
  const pct = (n: number) => `${Math.min(100, (n / max) * 100)}%`;
  const ok = length >= ideal[0] && length <= ideal[1];
  const state = length === 0 ? "Missing" : length < ideal[0] ? "Too short" : length > ideal[1] ? "May be cut off" : "Good length";
  const color = length === 0 ? COLOR.bad : ok ? COLOR.good : COLOR.warn;
  return (
    <div>
      <div className="flex items-baseline justify-between font-sub text-[12.5px]">
        <span className="text-ink-2">{label}</span>
        <span style={{ color }}>
          <span className="tabular-nums">{length}</span> chars · {state}
        </span>
      </div>
      <div className="relative mt-2 h-1.5 rounded-full bg-white/[0.06]" role="img" aria-label={`${label}: ${length} characters, ideal ${ideal[0]} to ${ideal[1]}. ${state}.`}>
        <span className="absolute inset-y-0 rounded-full bg-good/25" style={{ left: pct(ideal[0]), width: `calc(${pct(ideal[1])} - ${pct(ideal[0])})` }} />
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0d0e0f]" style={{ left: pct(length), background: color }} />
      </div>
      <div className="relative mt-1.5 h-3 font-sub text-[10.5px] text-ink-3">
        <span className="absolute -translate-x-1/2" style={{ left: pct(ideal[0]) }}>
          {ideal[0]}
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: pct(ideal[1]) }}>
          {ideal[1]}
        </span>
      </div>
    </div>
  );
}
