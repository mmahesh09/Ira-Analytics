"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bell, CheckCircle2, CircleAlert, CircleDot, ExternalLink, LinkIcon, LoaderCircle, Play, Rocket } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import { MODULES, ago } from "@/lib/format";
import { AUDIT_COST, DEEP_AUDIT_COST, DEEP_AUDIT_PAGES } from "@/lib/plans";
import { EFFORT_LABEL } from "@/lib/scoring";
import type { AlertRow, AuditPoint, Billing, IssueRow, LinkRow, SiteStatus, VerificationRow } from "@/lib/types";
import { COLOR } from "@/components/audit/charts";
import { Loading, NotFound, PageHeader, useSite } from "./workspace";

/** GET with reload; setState only in promise callbacks (no sync setState in effects). */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let live = true;
    apiFetch<T>(path)
      .then((d) => {
        if (!live) return;
        setData(d);
        setError(null);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : "Couldn't load."));
    return () => {
      live = false;
    };
  }, [path, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload };
}

const BRAND = "#bf5af2";
const SERIES: { key: keyof AuditPoint; label: string; color: string }[] = [
  { key: "seo", label: "SEO", color: COLOR.good },
  { key: "aeo", label: "AEO", color: "#3b82f6" },
  { key: "geo", label: "GEO", color: COLOR.warn },
  { key: "speed", label: "Speed", color: "#f472b6" },
];

/** Open issues in fix-first order (Smart Issue Prioritization): severity × confidence ÷ effort. */
export const byPriority = (a: IssueRow, b: IssueRow) =>
  ((b.severity === "fail" ? 1 : 0.5) * b.confidence) / b.effort - ((a.severity === "fail" ? 1 : 0.5) * a.confidence) / a.effort;

/** The four numbers at the top of Overview and Monitoring. */
export function HealthStats({ points, open, status, cadence }: { points: AuditPoint[]; open: IssueRow[] | null; status: SiteStatus | null; cadence: string }) {
  const latest = points.at(-1);
  const prev = points.at(-2);
  const stats: [string, string, number | null][] = [
    ["Health score", latest ? String(latest.overall) : "—", latest && prev ? latest.overall - prev.overall : null],
    ["Open issues", open ? String(open.length) : "—", null],
    ["Last audit", status?.last_audit_at ? ago(status.last_audit_at) : "Never", null],
    ["Next audit", status?.next_audit_at ? ago(status.next_audit_at) : cadence === "off" ? "Paused" : "Soon", null],
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
      {stats.map(([label, value, delta]) => (
        <div key={label} className="bg-[#0c0c0f] p-5">
          <dt className="eyebrow text-[10.5px]">{label}</dt>
          <dd className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-[30px] font-semibold tracking-[-0.03em] tabular-nums">{value}</span>
            {typeof delta === "number" && delta !== 0 && <span className={`font-mono text-[13px] ${delta > 0 ? "text-good" : "text-bad"}`}>{delta > 0 ? `+${delta}` : delta}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const dateShort = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

export function HistoryChart({ points, height = 260 }: { points: AuditPoint[]; height?: number }) {
  const [shown, setShown] = useState<Set<string>>(new Set());
  const data = points.map((p) => ({ ...p, label: dateShort.format(new Date(p.created_at)) }));
  const toggle = (k: string) =>
    setShown((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show module lines">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-cobalt/30 bg-cobalt-soft px-3 py-1 font-sub text-[12.5px] text-ink">
          <span className="size-2 rounded-full bg-cobalt" /> Overall
        </span>
        {SERIES.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={shown.has(s.key)}
            onClick={() => toggle(s.key)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 font-sub text-[12.5px] transition-colors ${shown.has(s.key) ? "border-white/[0.14] bg-white/[0.06] text-ink" : "border-transparent text-ink-3 hover:text-ink"}`}
          >
            <span className="size-2 rounded-full" style={{ background: s.color, opacity: shown.has(s.key) ? 1 : 0.4 }} /> {s.label}
          </button>
        ))}
      </div>
      <div className="mt-4" style={{ height }} role="img" aria-label={`Overall score over ${points.length} audits, latest ${points.at(-1)?.overall}`}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="overallFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BRAND} stopOpacity={0.32} />
                <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={COLOR.line} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: COLOR.ink3, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis domain={[0, 100]} ticks={[0, 50, 80, 100]} tick={{ fill: COLOR.ink3, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="rounded-lg border border-white/[0.1] bg-[#141516]/95 px-3 py-2 font-sub text-[12.5px] shadow-[0_12px_32px_rgb(0_0_0/0.5)]">
                    <p className="mb-1 text-ink-3">
                      {label} · {String((payload[0].payload as AuditPoint).trigger)}
                    </p>
                    {payload.map((p) => (
                      <p key={String(p.name)} className="flex items-center gap-2 text-ink">
                        <span className="size-2 rounded-full" style={{ background: p.color }} /> {p.name}: <span className="tabular-nums">{p.value ?? "n/a"}</span>
                      </p>
                    ))}
                  </div>
                ) : null
              }
            />
            <Area type="monotone" dataKey="overall" name="Overall" stroke={BRAND} strokeWidth={2.25} fill="url(#overallFill)" dot={{ r: 2.5, fill: BRAND }} activeDot={{ r: 5 }} />
            {SERIES.filter((s) => shown.has(s.key)).map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={1.5} dot={false} connectNulls />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Day-grouped feed of issues that appeared or were resolved. */
function ChangeLog({ issues }: { issues: IssueRow[] }) {
  const events = issues
    .flatMap((i) => [
      { at: i.first_seen_at, kind: "new" as const, issue: i },
      ...(i.resolved_at ? [{ at: i.resolved_at, kind: "resolved" as const, issue: i }] : []),
    ])
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 40);
  if (!events.length) return <p className="font-sub text-[13.5px] text-ink-3">Changes appear here after the second audit.</p>;
  return (
    <ol className="relative space-y-3 border-l border-line pl-5">
      {events.map((e) => (
        <li key={`${e.kind}-${e.issue.id}`} className="relative">
          <span
            aria-hidden="true"
            className={`absolute -left-[26px] top-1 grid size-[11px] place-items-center rounded-full border-2 border-[#0d0e0f] ${e.kind === "resolved" ? "bg-good" : e.issue.severity === "fail" ? "bg-bad" : "bg-warn"}`}
          />
          <p className="text-[14px] text-ink-2">
            <span className={e.kind === "resolved" ? "text-good" : e.issue.severity === "fail" ? "text-bad" : "text-warn"}>{e.kind === "resolved" ? "Resolved" : "New"}</span> · {e.issue.title}
          </p>
          <p className="font-sub text-[12px] text-ink-3">
            {MODULES[e.issue.module]?.label ?? e.issue.module} · {ago(e.at)}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function MonitoringPage() {
  const site = useSite();
  const id = site?.id;
  const history = useApi<AuditPoint[]>(id ? `/sites/${id}/history` : null);
  const issues = useApi<IssueRow[]>(id ? `/sites/${id}/issues?status=all` : null);
  const status = useApi<SiteStatus>(id ? `/sites/${id}/status` : null);
  const billing = useApi<Billing>("/billing");
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string; upgrade?: boolean } | null>(null);
  const busy = Boolean(status.data && (status.data.running.length || status.data.queued.length));
  const { reload: reloadBilling } = billing;
  const { reload: reloadStatus } = status;
  const { reload: reloadHistory } = history;
  const { reload: reloadIssues } = issues;

  // while an audit is queued or running, refresh every 8 s so results appear by themselves
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => {
      reloadStatus();
      reloadHistory();
      reloadIssues();
    }, 8000);
    return () => clearInterval(t);
  }, [busy, reloadStatus, reloadHistory, reloadIssues]);

  if (site === undefined) return <Loading />;
  if (site === null) return <NotFound />;

  async function start(kind: "check" | "audit" | "deep") {
    const left = billing.data?.credits.total;
    if (kind !== "check") {
      const cost = kind === "deep" ? DEEP_AUDIT_COST : AUDIT_COST;
      const what = kind === "deep" ? `a deep audit (up to ${DEEP_AUDIT_PAGES} pages)` : "a full audit";
      if (!window.confirm(`Run ${what} of ${site!.domain}? It uses ${cost} credit${cost > 1 ? "s" : ""}${left !== undefined ? ` (you have ${left})` : ""}. If no report comes out, the credit${cost > 1 ? "s come" : " comes"} back.`)) return;
    }
    setStarting(true);
    setNotice(null);
    try {
      if (kind === "check") {
        await apiFetch(`/sites/${site!.id}/check`, { method: "POST" });
        setNotice({ tone: "good", text: "Light check queued. It re-runs the SEO, AEO and GEO rules; it doesn't use a credit." });
      } else {
        await apiFetch(`/sites/${site!.id}/audits`, { body: { deep: kind === "deep" }, headers: { "Idempotency-Key": crypto.randomUUID() } });
      }
      reloadBilling();
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      setNotice({ tone: "bad", text: e instanceof Error ? e.message : "Couldn't start. Try again.", upgrade: status === 402 || status === 403 });
    }
    reloadStatus();
    setStarting(false);
  }

  const points = history.data ?? [];
  const open = (issues.data ?? []).filter((i) => i.status === "open");

  return (
    <>
      <PageHeader
        eyebrow={site.domain}
        title="Monitoring"
        subtitle={`${site.domain} · light checks ${site.audit_cadence === "off" ? "paused" : site.audit_cadence}${
          billing.data ? ` · ${billing.data.credits.total} audit credit${billing.data.credits.total === 1 ? "" : "s"} left` : ""
        }`}
        actions={
          <>
            <button
              type="button"
              onClick={() => start("check")}
              disabled={busy || starting}
              className="btn-ghost inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 font-sub text-[13.5px] disabled:cursor-wait disabled:opacity-70"
            >
              Light check
            </button>
            {billing.data?.entitlements.deep_audit && (
              <button
                type="button"
                onClick={() => start("deep")}
                disabled={busy || starting}
                className="btn-ghost inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 font-sub text-[13.5px] disabled:cursor-wait disabled:opacity-70"
              >
                Deep audit · {DEEP_AUDIT_COST} credits
              </button>
            )}
            <button
              type="button"
              onClick={() => start("audit")}
              disabled={busy || starting}
              className="btn-brand inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 font-sub text-[13.5px] font-medium disabled:cursor-wait disabled:opacity-70"
            >
              {busy || starting ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Play aria-hidden="true" className="size-3.5" />}
              {busy ? (status.data!.running.length ? "Running…" : "Queued") : `Full audit · ${AUDIT_COST} credit`}
            </button>
          </>
        }
      />
      <div className="space-y-6 px-6 py-8 lg:px-10">
        {notice && (
          <div
            role={notice.tone === "bad" ? "alert" : "status"}
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-3 font-sub text-[13.5px] text-ink-2 ${
              notice.tone === "bad" ? "border-bad/30 bg-bad-soft" : "border-good/30 bg-good-soft"
            }`}
          >
            <span>{notice.text}</span>
            {notice.upgrade && (
              <Link href="/app/billing" className="font-medium text-ink underline-offset-4 hover:underline">
                See plans and credits
              </Link>
            )}
          </div>
        )}
        <HealthStats points={points} open={issues.data ? open : null} status={status.data} cadence={site.audit_cadence} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section className="panel rounded-xl p-6">
            <h2 className="text-[17px] font-medium tracking-[-0.01em]">Health history</h2>
            <p className="mt-1 text-[14px] text-ink-3">Every audit, scheduled, manual or after a deploy.</p>
            <div className="mt-5">
              {points.length >= 2 ? (
                <HistoryChart points={points} />
              ) : (
                <div className="grid h-[260px] place-items-center rounded-lg border border-dashed border-white/[0.1] text-center">
                  <p className="max-w-[36ch] font-sub text-[13.5px] text-ink-3">
                    {points.length ? "One audit so far. The trend line appears after the next one." : "No audits yet. Click “Audit now” to record the first point."}
                  </p>
                </div>
              )}
            </div>
          </section>
          <section className="panel rounded-xl p-6">
            <h2 className="text-[17px] font-medium tracking-[-0.01em]">What changed</h2>
            <p className="mb-5 mt-1 text-[14px] text-ink-3">New and resolved issues, newest first.</p>
            {issues.data ? <ChangeLog issues={issues.data} /> : <div className="h-40 animate-pulse rounded-lg bg-white/[0.03]" />}
          </section>
        </div>
      </div>
    </>
  );
}

/** modules a free light check measures; other "Mark fixed" requests wait for the next full audit */
const LIGHT_MODULES = ["seo", "aeo", "geo"];

const VERDICT: Record<VerificationRow["status"], { label: string; className: string }> = {
  queued: { label: "Checking", className: "border-cobalt/30 bg-cobalt-soft text-ink" },
  fixed: { label: "Verified fixed", className: "border-good/30 bg-good-soft text-good" },
  still_failing: { label: "Still failing", className: "border-bad/30 bg-bad-soft text-bad" },
  unmeasured: { label: "Couldn\u2019t measure", className: "border-line-strong bg-white/[0.03] text-ink-3" },
};

/** "before → after" with the change coloured; dashes when a side wasn't measured. */
function BeforeAfter({ label, before, after }: { label: string; before: number | null; after: number | null }) {
  const delta = before != null && after != null ? after - before : null;
  return (
    <div>
      <p className="eyebrow text-[10px]">{label}</p>
      <p className="mt-1 font-mono text-[15px] tabular-nums">
        <span className="text-ink-3">{before ?? "—"}</span> <span className="text-ink-3">→</span> <span className="text-ink">{after ?? "…"}</span>
        {delta != null && delta !== 0 && <span className={`ml-1.5 text-[12.5px] ${delta > 0 ? "text-good" : "text-bad"}`}>{delta > 0 ? `+${delta}` : delta}</span>}
      </p>
    </div>
  );
}

/** Before-and-After Verification results, newest first. */
function Verifications({ rows }: { rows: VerificationRow[] }) {
  if (!rows.length) return null;
  return (
    <section className="panel rounded-xl p-6">
      <p className="eyebrow flex items-center gap-2 text-[11px]">
        <CheckCircle2 aria-hidden="true" className="size-3.5 text-cobalt" /> Before &amp; after
      </p>
      <h2 className="mt-2 text-[17px] font-medium tracking-[-0.01em]">Verified fixes</h2>
      <p className="mt-1 text-[14px] text-ink-3">
        &ldquo;Mark fixed&rdquo; rechecks SEO, AEO and GEO fixes with a free light check. Speed and accessibility fixes are confirmed by your next full audit.
      </p>
      <ul className="mt-5 grid gap-3 md:grid-cols-2">
        {rows.slice(0, 6).map((v) => (
          <li key={v.id} className="rounded-lg border border-line bg-white/[0.015] p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-[14px] leading-snug text-ink">{v.title}</p>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 font-sub text-[11px] font-medium ${VERDICT[v.status].className}`}>
                {v.status === "queued" && LIGHT_MODULES.includes(v.module) && <LoaderCircle aria-hidden="true" className="mr-1 inline size-3 animate-spin" />}
                {v.status === "queued" && !LIGHT_MODULES.includes(v.module) ? "Next full audit" : VERDICT[v.status].label}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <BeforeAfter label="Overall" before={v.before_overall} after={v.after_overall} />
              <BeforeAfter label={MODULES[v.module]?.label ?? v.module} before={v.before_module} after={v.after_module} />
            </div>
            <p className="mt-2 font-sub text-[12px] text-ink-3">{v.finished_at ? `Checked ${ago(v.finished_at)}` : `Requested ${ago(v.requested_at)} · usually a minute or two`}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function IssuesPage() {
  const site = useSite();
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const issues = useApi<IssueRow[]>(site ? `/sites/${site.id}/issues?status=${tab}` : null);
  const checks = useApi<VerificationRow[]>(site ? `/sites/${site.id}/verifications` : null);
  const [error, setError] = useState<string | null>(null);
  const checking = new Set((checks.data ?? []).filter((v) => v.status === "queued").map((v) => v.issue_id));
  const { reload: reloadChecks } = checks;
  const { reload: reloadIssues } = issues;

  // while a verification is pending, refresh every 8 s so the verdict appears by itself
  const waiting = checking.size > 0;
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => {
      reloadChecks();
      reloadIssues();
    }, 8000);
    return () => clearInterval(t);
  }, [waiting, reloadChecks, reloadIssues]);

  if (site === undefined) return <Loading />;
  if (site === null) return <NotFound />;

  async function markFixed(issueId: number) {
    setError(null);
    try {
      await apiFetch(`/sites/${site!.id}/issues/${issueId}/verify`, { method: "POST" });
      reloadChecks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn\u2019t start the check. Try again.");
    }
  }
  // open issues in fix-first order (Smart Issue Prioritization); resolved ones stay newest first
  const rows = tab === "open" ? [...(issues.data ?? [])].sort(byPriority) : (issues.data ?? []);
  return (
    <>
      <PageHeader eyebrow={site.domain} title="Issues" subtitle="Every problem we've tracked. Open issues are in fix-first order: impact, confidence and effort." />
      <div className="space-y-5 px-6 py-8 lg:px-10">
        <div role="tablist" aria-label="Issue status" className="inline-flex rounded-full border border-white/[0.1] bg-white/[0.03] p-1">
          {(["open", "resolved"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`h-8 cursor-pointer rounded-full px-4 font-sub text-[13px] capitalize transition-colors ${tab === t ? "bg-cobalt-soft text-ink ring-1 ring-cobalt/30" : "text-ink-3 hover:text-ink"}`}
            >
              {t}
            </button>
          ))}
        </div>
        {checks.data && <Verifications rows={checks.data} />}
        {error && (
          <p role="alert" className="rounded-lg border border-bad/30 bg-bad-soft px-4 py-3 font-sub text-[13.5px] text-ink-2">
            {error}
          </p>
        )}
        {!issues.data ? (
          <div className="h-48 animate-pulse rounded-xl bg-white/[0.03]" />
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/[0.1] p-8 text-center font-sub text-[14px] text-ink-3">
            {tab === "open" ? "No open issues. Nice." : "Resolved issues appear here once a later audit confirms the fix."}
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {rows.map((i) => (
              <li key={i.id} className="flex items-center gap-3 bg-[#0c0c0f] px-4 py-3.5 sm:gap-4 sm:px-5">
                {i.status === "resolved" ? (
                  <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-good" />
                ) : i.severity === "fail" ? (
                  <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-bad" />
                ) : (
                  <CircleDot aria-hidden="true" className="size-4 shrink-0 text-warn" />
                )}
                <span className="min-w-0 flex-1 truncate text-[14.5px]">{i.title}</span>
                {i.status === "open" && (
                  <span className="hidden shrink-0 font-sub text-[12px] text-ink-3 md:inline" title="Estimated effort">
                    {EFFORT_LABEL[i.effort] ?? ""}
                  </span>
                )}
                <span className="hidden shrink-0 rounded border border-white/[0.08] px-1.5 py-0.5 font-sub text-[11px] text-ink-3 sm:inline">{MODULES[i.module]?.label ?? i.module}</span>
                <span className="hidden w-28 shrink-0 text-right font-sub text-[12.5px] text-ink-3 md:inline">{i.resolved_at ? `fixed ${ago(i.resolved_at)}` : `since ${ago(i.first_seen_at)}`}</span>
                {i.status === "open" &&
                  (checking.has(i.id) ? (
                    <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-cobalt/30 bg-cobalt-soft px-3 font-sub text-[12.5px] text-ink">
                      <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin text-cobalt" /> Checking
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => markFixed(i.id)}
                      className="btn-ghost inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 font-sub text-[12.5px]"
                    >
                      <CheckCircle2 aria-hidden="true" className="size-3.5" /> Mark fixed
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export function LinksPage() {
  const site = useSite();
  const links = useApi<LinkRow[]>(site ? `/sites/${site.id}/links?broken=true` : null);
  if (site === undefined) return <Loading />;
  if (site === null) return <NotFound />;
  const rows = links.data ?? [];
  const internal = rows.filter((r) => r.internal).length;
  return (
    <>
      <PageHeader eyebrow={site.domain} title="Broken links" subtitle="Checked with every full audit, across your own pages and the sites you link to." />
      <div className="space-y-5 px-6 py-8 lg:px-10">
        {links.data && (
          <p className="font-sub text-[14px] text-ink-2">
            <span className="tabular-nums text-ink">{rows.length}</span> broken · {internal} on your site · {rows.length - internal} external
          </p>
        )}
        {!links.data ? (
          <div className="h-48 animate-pulse rounded-xl bg-white/[0.03]" />
        ) : rows.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-good/25 bg-good-soft p-6">
            <LinkIcon aria-hidden="true" className="size-5 text-good" />
            <p className="text-[14.5px] text-ink-2">No broken links found. We&apos;ll alert you if one breaks.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {rows.map((r) => (
              <li key={r.url} className="grid gap-1 bg-[#0d0e0f] px-5 py-3.5 sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                <span className="w-fit rounded bg-bad-soft px-1.5 py-0.5 font-mono text-[12px] text-bad">{r.status_code ?? "error"}</span>
                <span className="min-w-0">
                  <a href={r.url} target="_blank" rel="noreferrer nofollow" className="inline-flex max-w-full items-center gap-1 truncate text-[14px] hover:underline">
                    <span className="truncate">{r.url}</span> <ExternalLink aria-hidden="true" className="size-3 shrink-0 text-ink-3" />
                  </a>
                  <span className="block truncate font-sub text-[12px] text-ink-3">
                    on {r.source_url.replace(/^https?:\/\//, "")}
                    {r.error ? ` · ${r.error}` : ""}
                  </span>
                </span>
                <span className="font-sub text-[12px] text-ink-3">{r.first_broken_at ? `broken ${ago(r.first_broken_at)}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

const ALERT_ICON = { regression: Rocket, new_issue: CircleAlert, broken_links: LinkIcon, verified: CheckCircle2 } as const;

/** Bell with unread count; opens the latest alerts across all sites. */
export function AlertsBell() {
  const [open, setOpen] = useState(false);
  const alerts = useApi<AlertRow[]>("/alerts");
  const unread = (alerts.data ?? []).filter((a) => !a.read).length;

  async function markRead() {
    await apiFetch("/alerts/read", { method: "POST" }).catch(() => {});
    alerts.reload();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={unread ? `Alerts, ${unread} unread` : "Alerts"}
        className="relative grid size-8 cursor-pointer place-items-center rounded-md text-ink-3 transition-colors hover:bg-white/[0.05] hover:text-ink"
      >
        <Bell aria-hidden="true" className="size-4" />
        {unread > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-bad ring-2 ring-surface-ink" />}
      </button>
      {open && (
        <div className="absolute bottom-10 left-0 z-50 w-[320px] overflow-hidden rounded-xl border border-white/[0.1] bg-[#141516] shadow-[0_24px_64px_rgb(0_0_0/0.6)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-sub text-[13px] font-medium">Alerts</p>
            {unread > 0 && (
              <button type="button" onClick={markRead} className="cursor-pointer font-sub text-[12px] text-ink-3 hover:text-ink">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[360px] divide-y divide-line overflow-y-auto">
            {(alerts.data ?? []).length === 0 && <li className="px-4 py-6 text-center font-sub text-[13px] text-ink-3">No alerts yet. We&apos;ll tell you when something changes.</li>}
            {(alerts.data ?? []).map((a) => {
              const Icon = ALERT_ICON[a.kind as keyof typeof ALERT_ICON] ?? CircleAlert;
              return (
                <li key={a.id} className={`flex gap-3 px-4 py-3 ${a.read ? "" : "bg-white/[0.03]"}`}>
                  <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-3" />
                  <div className="min-w-0">
                    <p className="text-[13.5px] leading-snug text-ink-2">{a.message}</p>
                    <p className="mt-0.5 font-sub text-[11.5px] text-ink-3">
                      <Link href={`/app/${a.site_id}/monitoring`} onClick={() => setOpen(false)} className="hover:text-ink">
                        {a.site_name}
                      </Link>{" "}
                      · {ago(a.created_at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
