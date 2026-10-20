"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, MotionConfig, m } from "framer-motion";
import { ArrowRight, CircleAlert, CircleCheck, CircleDashed, CircleSlash, CloudOff, ExternalLink, LoaderCircle, RotateCcw } from "lucide-react";
import { streamAudit } from "@/lib/api";
import { MODULES, SCORED_MODULES, TONE_BG, TONE_LABEL, TONE_TEXT, compact, scoreTone } from "@/lib/format";
import type { AuditReport, ModuleKey, ModuleResult } from "@/lib/types";
import { UrlForm } from "@/components/url-form";
import { prioritize, project, rankFixes } from "@/lib/scoring";
import { ScoreGauge, SeverityDonut, type Severity } from "./charts";
import { CheckWaffle, ReportCover, VisibilityJourney } from "./infographics";
import { ScoreSimulator } from "./score-simulator";
import { OpportunityPlan } from "./opportunity-plan";
import { RewriteTarget } from "./ai-rewrite";
import { CheckItem, CheckList } from "./check-list";
import { AeoExtras, GeoExtras, PerformanceExtras, SeoExtras, TrafficPanel } from "./module-panels";
import { VisualDoctor } from "./visual-doctor";
import { ScoreBreakdown } from "./score-breakdown";
import BackgroundPaths from "@/components/kokonutui/background-paths";

type Tab = "overview" | ModuleKey;
// The public audit is a free preview (a light check on the server): SEO, AEO and GEO rules only. Speed,
// accessibility and the broken-link crawl run in full audits, inside an account.
const TABS: Tab[] = ["overview", "seo", "aeo", "geo"];
const STAGES: { key: "fetch" | ModuleKey; label: string }[] = [
  { key: "fetch", label: "fetch page, robots.txt, sitemap, llms.txt" },
  { key: "seo", label: "seo: on-page checks" },
  { key: "aeo", label: "aeo: answer-engine readiness" },
  { key: "geo", label: "geo: AI crawler access + trust signals" },
];
const EASE = [0.16, 1, 0.3, 1] as const;

export function AuditView() {
  const url = useSearchParams().get("url");
  const [runId, setRunId] = useState(0);
  if (!url) {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-4 py-24 sm:px-6">
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-semibold tracking-[-0.03em]">Audit a website</h1>
        <p className="mb-10 mt-3 text-[18px] text-ink-2">Enter any public URL to get SEO, AEO and GEO scores.</p>
        <UrlForm autoFocus />
      </div>
    );
  }
  return <AuditRun key={`${url}#${runId}`} url={url} onRerun={() => setRunId((n) => n + 1)} />;
}

function AuditRun({ url, onRerun }: { url: string; onRerun: () => void }) {
  const [fetchDone, setFetchDone] = useState(false);
  const [modules, setModules] = useState<Partial<Record<ModuleKey, ModuleResult>>>({});
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(
    () =>
      streamAudit(url, (event) => {
        if (event.type === "stage") setFetchDone(event.status === "done");
        else if (event.type === "module") setModules((m) => ({ ...m, [event.module.key]: event.module }));
        else if (event.type === "result") {
          setFetchDone(true);
          setModules(event.report.modules);
          setReport(event.report);
        } else if (event.type === "error") setError(event.message);
      }),
    [url],
  );

  const running = !report && !error;
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [running]);

  let host = url;
  try {
    host = new URL(report?.final_url ?? url).hostname.replace(/^www\./, "");
  } catch {}

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[720px] px-4 py-24 sm:px-6">
        <div role="alert" className="rounded-2xl border border-bad/30 bg-bad-soft p-6">
          <div className="flex gap-3">
            <CircleAlert aria-hidden="true" className="size-6 shrink-0 text-bad" />
            <div>
              <h1 className="text-[24px] font-semibold tracking-[-0.02em]">We couldn&apos;t audit {host}</h1>
              <p className="mt-2 text-ink-2">{error}</p>
            </div>
          </div>
        </div>
        <div className="mt-10">
          <UrlForm defaultValue={url} autoFocus />
        </div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative isolate">
        {/* decorative: flowing purple paths behind the top of the report */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[680px] overflow-hidden">
          <BackgroundPaths className="h-full min-h-0 bg-transparent text-cobalt/60 dark:bg-transparent dark:text-cobalt/60" count={36} speed={0.6} interactive={false}>
            {null}
          </BackgroundPaths>
        </div>
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-[minmax(0,1fr)] gap-8 px-4 pb-24 pt-8 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10">
          <Sidebar host={host} url={report?.final_url ?? url} report={report} modules={modules} running={running} elapsed={elapsed} tab={tab} setTab={setTab} onRerun={onRerun} />
          <div className="min-w-0">
            {report ? (
              <ReportPanel report={report} host={host} tab={tab} setTab={setTab} />
            ) : (
              <ProgressLog fetchDone={fetchDone} modules={modules} elapsed={elapsed} />
            )}
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}

function Sidebar({
  host,
  url,
  report,
  modules,
  running,
  elapsed,
  tab,
  setTab,
  onRerun,
}: {
  host: string;
  url: string;
  report: AuditReport | null;
  modules: Partial<Record<ModuleKey, ModuleResult>>;
  running: boolean;
  elapsed: number;
  tab: Tab;
  setTab: (t: Tab) => void;
  onRerun: () => void;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tone = report ? scoreTone(report.overall_score) : null;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!report) return;
    const i = TABS.indexOf(tab);
    const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const next = TABS[(i + (keys.indexOf(event.key) < 2 ? 1 : -1) + TABS.length) % TABS.length];
    setTab(next);
    refs.current[next]?.focus();
  }

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="panel rounded-xl p-5">
        <p className="flex items-center gap-2 font-sub text-[12.5px] text-ink-3">
          <span className={`size-1.5 rounded-full ${running ? "animate-pulse bg-warn" : "bg-good"}`} />
          {running ? `Auditing · ${elapsed}s` : "Audit report"}
        </p>
        <h1 className="mt-2 truncate text-[22px] font-semibold tracking-[-0.025em]">{host}</h1>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate font-sub text-[13px] text-ink-3 transition-colors duration-200 hover:text-ink"
        >
          <span className="truncate">{url}</span>
          <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
        </a>

        <div className="mt-6 flex items-center gap-4">
          {report && tone ? (
            <>
              <ScoreGauge score={report.overall_score} size={112} label="Overall score" caption="of 100" />
              <div>
                <p className="font-sub text-[12px] text-ink-3">Overall visibility</p>
                <p className={`text-[20px] font-semibold tracking-[-0.02em] ${TONE_TEXT[tone]}`}>{TONE_LABEL[tone]}</p>
                <p className="mt-1 font-sub text-[12px] text-ink-3">{new Date(report.fetched_at).toLocaleDateString()}</p>
              </div>
            </>
          ) : (
            <>
              <div className="grid size-[112px] shrink-0 place-items-center rounded-full border-[8px] border-white/[0.06]">
                <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-ink-3" />
              </div>
              <p className="font-sub text-[14px] text-ink-2">Scores appear as each module finishes.</p>
            </>
          )}
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Report sections"
        aria-orientation="vertical"
        onKeyDown={onKeyDown}
        className="-mx-4 mt-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
      >
        {TABS.map((t) => {
          const mod = t === "overview" ? undefined : modules[t];
          const selected = report !== null && t === tab;
          const score = mod?.available ? mod.score : null;
          return (
            <button
              key={t}
              ref={(el) => {
                refs.current[t] = el;
              }}
              role="tab"
              id={`tab-${t}`}
              aria-selected={selected}
              aria-controls={`panel-${t}`}
              tabIndex={selected || (!report && t === "overview") ? 0 : -1}
              disabled={!report}
              onClick={() => setTab(t)}
              className={`relative flex h-10 shrink-0 cursor-pointer items-center justify-between gap-4 rounded-lg px-3 font-sub text-[14px] transition-colors duration-200 disabled:cursor-default lg:w-full ${
                selected ? "text-ink" : "text-ink-3 hover:bg-white/[0.03] hover:text-ink"
              }`}
            >
              {selected && <m.span layoutId="rail-active" className="absolute inset-0 rounded-lg border border-cobalt/30 bg-cobalt-soft" transition={{ duration: 0.3, ease: EASE }} />}
              <span className="relative">{t === "overview" ? "Fix first" : MODULES[t].name.split(" ")[0] === "Organic" ? "Traffic" : MODULES[t].label}</span>
              <span className="relative">
                {t === "overview" ? null : !mod && running ? (
                  <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                ) : score != null ? (
                  <span className={`rounded-md px-1.5 py-0.5 font-mono text-[12px] ${TONE_BG[scoreTone(score)]} ${TONE_TEXT[scoreTone(score)]}`}>{score}</span>
                ) : t === "traffic" && mod?.available ? (
                  <span className="font-mono text-[12px]">{compact((mod.data.estimated_monthly_visits as number) ?? 0)}</span>
                ) : (
                  <span className="text-[12px] text-ink-3">n/a</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 hidden gap-2 lg:flex">
        <button
          type="button"
          onClick={onRerun}
          disabled={running}
          className="btn-ghost inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full font-sub text-[13.5px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" /> Re-run
        </button>
        <Link
          href="/#audit"
          className="btn-brand inline-flex h-10 flex-1 items-center justify-center rounded-full font-sub text-[13.5px] font-medium"
        >
          New audit
        </Link>
      </div>
    </aside>
  );
}

function ProgressLog({ fetchDone, modules, elapsed }: { fetchDone: boolean; modules: Partial<Record<ModuleKey, ModuleResult>>; elapsed: number }) {
  return (
    <section aria-live="polite" aria-label="Audit progress" className="panel overflow-hidden rounded-xl">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="ml-3 font-sub text-[12px] text-ink-3">audit.log</span>
        <span className="ml-auto font-mono text-[12px] text-ink-3">{elapsed}s</span>
      </div>
      <ol className="space-y-1 p-5 font-mono text-[14px] sm:p-6">
        {STAGES.map(({ key, label }, i) => {
          const mod = key === "fetch" ? undefined : modules[key];
          const state = key === "fetch" ? (fetchDone ? "done" : "running") : mod ? (mod.available ? "done" : "skipped") : fetchDone ? "running" : "pending";
          if (state === "pending") return null;
          return (
            <m.li
              key={key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: EASE, delay: key === "fetch" ? 0 : (i - 1) * 0.05 }}
              className="flex items-center gap-3 py-1.5"
            >
              {state === "done" && <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-good" />}
              {state === "running" && <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin text-ink-2" />}
              {state === "skipped" && <CircleSlash aria-hidden="true" className="size-4 shrink-0 text-ink-3" />}
              <span className={state === "running" ? "text-ink" : "text-ink-2"}>
                <span className="text-ink-3">›</span> {label}
                <span className="sr-only">: {state}</span>
              </span>
              {mod?.available && mod.score != null && (
                <span className={`ml-auto rounded-md px-2 py-0.5 text-[12px] ${TONE_BG[scoreTone(mod.score)]} ${TONE_TEXT[scoreTone(mod.score)]}`}>{mod.score}</span>
              )}
              {state === "skipped" && <span className="ml-auto text-[12px] text-ink-3">unavailable</span>}
            </m.li>
          );
        })}
        {!fetchDone && (
          <li className="flex items-center gap-3 py-1.5 text-ink-3">
            <CircleDashed aria-hidden="true" className="size-4" /> waiting for modules…
          </li>
        )}
      </ol>
      <p className="border-t border-line px-5 py-3 font-sub text-[13px] text-ink-3 sm:px-6">Usually 30–60 seconds. Lighthouse is the slowest step.</p>
    </section>
  );
}

function ReportPanel({ report, host, tab, setTab }: { report: AuditReport; host: string; tab: Tab; setTab: (t: Tab) => void }) {
  // Smart Issue Prioritization: impact × confidence ÷ effort
  const ranked = useMemo(() => prioritize(report), [report]);
  const [focus, setFocus] = useState<"all" | "quick" | "critical">("all");
  const priorities = ranked
    .filter((f) => (focus === "quick" ? f.effort === 1 : focus === "critical" ? f.severity === "critical" : true))
    .slice(0, 10)
    .map((f) => ({ check: f.check, key: f.module, gain: f.gain as number | undefined }));
  const active = tab === "overview" ? undefined : report.modules[tab];
  const traffic = report.modules.traffic;
  const all = Object.values(report.modules).flatMap((mod) => mod?.checks ?? []);
  const counts = { fail: all.filter((c) => c.status === "fail").length, warn: all.filter((c) => c.status === "warn").length, pass: all.filter((c) => c.status === "pass").length };
  // what's achievable: the five highest-value fixes (same ranking as the simulator)
  const topFixes = useMemo(() => rankFixes(report).slice(0, 5).filter((f) => f.gain > 0), [report]);
  const potential = useMemo(() => project(report, new Set(topFixes.map((f) => f.key))).projected, [report, topFixes]);

  // chart interactions: donut filters the issue list; bar segments open a module pre-filtered
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [moduleFilter, setModuleFilter] = useState<{ key: string; status: Severity } | null>(null);
  const openModule = (key: string, status?: Severity) => {
    setModuleFilter(status ? { key, status } : null);
    setTab(key as ModuleKey);
  };
  const SEVERITY_TITLE: Record<Severity, string> = { fail: "Critical issues", warn: "Improvements", pass: "Passed checks" };
  const listed = severity
    ? SCORED_MODULES.flatMap((key) => (report.modules[key]?.checks ?? []).filter((c) => c.status === severity).map((check) => ({ check, key, gain: undefined as number | undefined })))
        .sort((a, b) => b.check.weight - a.check.weight)
    : priorities;
  const target = useMemo(() => ({ url: report.final_url, domain: report.domain }), [report]);

  return (
    <RewriteTarget.Provider value={target}>
    <AnimatePresence mode="wait">
      <m.div
        key={tab}
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        {tab === "overview" && (
          <div className="space-y-6">
            <ReportCover report={report} host={host} potential={potential} fixCount={topFixes.length} onOpen={(k) => openModule(k)} />
            <VisibilityJourney report={report} onOpen={(k) => openModule(k)} />
            <ScoreBreakdown report={report} />
            <OpportunityPlan report={report} />
            <ScoreSimulator report={report} />

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <section aria-live="polite">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="text-[22px] font-semibold tracking-[-0.025em]">{severity ? `${SEVERITY_TITLE[severity]} (${listed.length})` : "Fix these first"}</h2>
                  {severity && (
                    <button type="button" onClick={() => setSeverity(null)} className="cursor-pointer font-sub text-[13px] text-ink-3 underline-offset-4 hover:text-ink hover:underline">
                      Show top priorities
                    </button>
                  )}
                </div>
                <p className="mt-1 text-[15px] text-ink-3">
                  {severity ? "Filtered from the chart. Click the slice again to clear." : "Ranked by points gained, confidence and effort. Code to paste is inside each issue."}
                </p>
                {!severity && (
                  <div role="group" aria-label="Focus" className="mt-4 flex flex-wrap gap-2">
                    {(
                      [
                        ["all", "All", ranked.length],
                        ["quick", "Quick wins", ranked.filter((f) => f.effort === 1).length],
                        ["critical", "Critical", ranked.filter((f) => f.severity === "critical").length],
                      ] as const
                    ).map(([key, label, n]) => (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={focus === key}
                        onClick={() => setFocus(key)}
                        className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-4 font-sub text-[13px] font-medium transition-colors duration-200 ${
                          focus === key ? "border-cobalt/50 bg-cobalt-soft text-ink" : "border-line text-ink-3 hover:border-line-strong hover:text-ink"
                        }`}
                      >
                        {label} <span className="font-mono text-ink-3">{n}</span>
                      </button>
                    ))}
                  </div>
                )}
                {listed.length ? (
                  <ul className="mt-5 space-y-2.5">
                    {listed.map(({ check, key, gain }) => (
                      <CheckItem key={`${key}-${check.id}`} check={check} tag={MODULES[key].label} gain={gain} />
                    ))}
                  </ul>
                ) : (
                  <p className="mt-5 rounded-xl border border-good/30 bg-good-soft p-5 text-good">
                    {severity ? "Nothing in this group." : "No issues found. This page is in great shape."}
                  </p>
                )}
              </section>
              <aside className="space-y-4">
                <div className="panel rounded-xl p-5">
                  <p className="font-sub text-[13px] text-ink-3">Check results</p>
                  <div className="mt-4">
                    <SeverityDonut counts={counts} selected={severity} onSelect={setSeverity} />
                  </div>
                </div>
                <div className="panel rounded-xl p-5">
                  <p className="font-sub text-[13px] text-ink-3">Every check at a glance</p>
                  <div className="mt-4">
                    <CheckWaffle report={report} onOpen={(k, status) => openModule(k, status)} />
                  </div>
                </div>
                <div className="panel rounded-xl border-cobalt/30 p-5">
                  <p className="eyebrow text-[10.5px]">Free preview</p>
                  <p className="mt-2 text-[15px] font-medium leading-snug">This preview checks SEO, AEO and GEO rules on one page.</p>
                  <p className="mt-1.5 font-sub text-[13.5px] leading-relaxed text-ink-3">
                    A full audit adds Speed scores, accessibility checks and a broken-link crawl and keeps the history, and free light checks keep watching in between. Free accounts get one full audit every month.
                  </p>
                  <Link href="/signup" className="btn-brand mt-4 inline-flex h-9 items-center gap-1.5 rounded-full px-4 font-sub text-[13.5px] font-medium">
                    Get a free full audit <ArrowRight aria-hidden="true" className="size-3.5" />
                  </Link>
                </div>
                <p className="px-1 text-[12.5px] leading-relaxed text-ink-3">
                  Preview score from SEO, AEO and GEO only, so it can differ from a full audit. Checked {new Date(report.fetched_at).toLocaleString()}.
                </p>
              </aside>
            </div>
          </div>
        )}

        {tab === "traffic" && (
          <div className="space-y-6">
            <ModuleHeader moduleKey="traffic" module={traffic} />
            <TrafficPanel module={traffic} />
          </div>
        )}

        {active && tab !== "traffic" && tab !== "overview" && (
          <div className="space-y-8">
            <ModuleHeader moduleKey={tab} module={active} />
            {!active.available ? (
              <Unavailable moduleKey={tab} />
            ) : (
              <>
                {tab === "seo" && <SeoExtras module={active} url={report.final_url} />}
                {tab === "aeo" && <AeoExtras module={active} />}
                {tab === "geo" && <GeoExtras module={active} />}
                {tab === "performance" && <PerformanceExtras module={active} />}
                {tab === "accessibility" && <VisualDoctor module={active} />}
                <CheckList
                  key={`${tab}-${moduleFilter?.key === tab ? moduleFilter.status : "all"}`}
                  checks={active.checks}
                  initialFilter={moduleFilter?.key === tab ? moduleFilter.status : "all"}
                />
              </>
            )}
          </div>
        )}

        {!active && tab !== "overview" && tab !== "traffic" && <p className="text-ink-3">This module didn&apos;t return results.</p>}
      </m.div>
    </AnimatePresence>
    </RewriteTarget.Provider>
  );
}

function ModuleHeader({ moduleKey, module }: { moduleKey: ModuleKey; module?: ModuleResult }) {
  const meta = MODULES[moduleKey];
  const score = module?.available ? module.score : null;
  return (
    <header className="panel flex flex-col gap-6 rounded-xl p-6 sm:flex-row sm:items-center">
      {score != null && <ScoreGauge score={score} size={104} label={`${meta.label} score`} caption="of 100" />}
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-sub text-[13px] text-ink-3">
          <span className="size-1.5 rounded-full bg-cobalt shadow-[0_0_8px_var(--cobalt)]" />
          {meta.label}
        </p>
        <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.03em]">{meta.name}</h2>
        <p className="mt-1 text-[15px] text-ink-2">{meta.blurb}</p>
        {module?.available && module.summary && <p className="mt-2 font-sub text-[13.5px] text-ink-3">{module.summary}</p>}
      </div>
    </header>
  );
}

const UNAVAILABLE: Partial<Record<ModuleKey, string>> = {
  performance: "Speed comes from Google's Lighthouse service, which didn't answer this time (usually a temporary rate limit). Re-run the audit in a few minutes.",
};

/** A module that couldn't run: say so plainly instead of showing an empty box. */
function Unavailable({ moduleKey }: { moduleKey: ModuleKey }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed border-white/[0.12] p-8 sm:flex-row">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/[0.05]">
        <CloudOff aria-hidden="true" className="size-5 text-ink-3" />
      </span>
      <div>
        <p className="text-[16px] font-medium">{MODULES[moduleKey].label} couldn&apos;t be measured this time</p>
        <p className="mt-1 max-w-[60ch] text-[14.5px] leading-relaxed text-ink-3">
          {UNAVAILABLE[moduleKey] ?? "This check didn't return results. Re-run the audit to try again."} It isn&apos;t counted in the overall score.
        </p>
      </div>
    </div>
  );
}
