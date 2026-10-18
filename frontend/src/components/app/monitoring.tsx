"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bell, CheckCircle2, CircleAlert, CircleDot, ExternalLink, LinkIcon, LoaderCircle, Play, Rocket } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { MODULES, ago } from "@/lib/format";
import { EFFORT_LABEL } from "@/lib/scoring";
import type { AlertRow, AuditPoint, IssueRow, LinkRow, SiteStatus } from "@/lib/types";
import { COLOR } from "@/components/audit/charts";
import { Loading, NotFound, PageHeader, useSite } from "./site-pages";

/** GET with reload; setState only in promise callbacks (no sync setState in effects). */
function useApi<T>(path: string | null) {
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

const SERIES: { key: keyof AuditPoint; label: string; color: string }[] = [
  { key: "seo", label: "SEO", color: COLOR.good },
  { key: "aeo", label: "AEO", color: "#3b82f6" },
  { key: "geo", label: "GEO", color: COLOR.warn },
  { key: "speed", label: "Speed", color: "#bf5af2" },
];

const dateShort = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

function HistoryChart({ points }: { points: AuditPoint[] }) {
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
        <span className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.08] px-2.5 py-1 font-sub text-[12.5px] text-ink">
          <span className="size-2 rounded-full bg-ink" /> Overall
        </span>
        {SERIES.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={shown.has(s.key)}
            onClick={() => toggle(s.key)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 font-sub text-[12.5px] transition-colors ${shown.has(s.key) ? "bg-white/[0.08] text-ink" : "text-ink-3 hover:text-ink"}`}
          >
            <span className="size-2 rounded-full" style={{ background: s.color, opacity: shown.has(s.key) ? 1 : 0.4 }} /> {s.label}
          </button>
        ))}
      </div>
      <div className="mt-4 h-[260px]" role="img" aria-label={`Overall score over ${points.length} audits, latest ${points.at(-1)?.overall}`}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="overallFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR.ink} stopOpacity={0.18} />
                <stop offset="100%" stopColor={COLOR.ink} stopOpacity={0} />
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
            <Area type="monotone" dataKey="overall" name="Overall" stroke={COLOR.ink} strokeWidth={2} fill="url(#overallFill)" dot={{ r: 2.5, fill: COLOR.ink }} activeDot={{ r: 5 }} />
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
  const [starting, setStarting] = useState(false);
  const busy = Boolean(status.data && (status.data.running.length || status.data.queued.length));
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

  async function auditNow() {
    setStarting(true);
    await apiFetch(`/sites/${site!.id}/audits`, { method: "POST" }).catch(() => {});
    reloadStatus();
    setStarting(false);
  }

  const points = history.data ?? [];
  const latest = points.at(-1);
  const prev = points.at(-2);
  const open = (issues.data ?? []).filter((i) => i.status === "open");

  return (
    <>
      <PageHeader
        title="Monitoring"
        subtitle={`${site.domain} · audits ${site.audit_cadence === "off" ? "paused" : site.audit_cadence}`}
        actions={
          <button
            type="button"
            onClick={auditNow}
            disabled={busy || starting}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-ink px-3.5 font-sub text-[13.5px] font-medium text-paper transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-70"
          >
            {busy || starting ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Play aria-hidden="true" className="size-3.5" />}
            {busy ? (status.data!.running.length ? "Auditing…" : "Queued") : "Audit now"}
          </button>
        }
      />
      <div className="space-y-6 px-6 py-8 lg:px-10">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
          {[
            ["Health score", latest ? String(latest.overall) : "—", latest && prev ? latest.overall - prev.overall : null],
            ["Open issues", issues.data ? String(open.length) : "—", null],
            ["Last audit", status.data?.last_audit_at ? ago(status.data.last_audit_at) : "Never", null],
            ["Next audit", status.data?.next_audit_at ? ago(status.data.next_audit_at) : site.audit_cadence === "off" ? "Paused" : "Soon", null],
          ].map(([label, value, delta]) => (
            <div key={label as string} className="bg-[#0d0e0f] p-5">
              <dt className="font-sub text-[12.5px] text-ink-3">{label}</dt>
              <dd className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-[28px] font-semibold tracking-[-0.03em] tabular-nums">{value}</span>
                {typeof delta === "number" && delta !== 0 && <span className={`font-sub text-[13px] ${delta > 0 ? "text-good" : "text-bad"}`}>{delta > 0 ? `+${delta}` : delta}</span>}
              </dd>
            </div>
          ))}
        </dl>

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

export function IssuesPage() {
  const site = useSite();
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const issues = useApi<IssueRow[]>(site ? `/sites/${site.id}/issues?status=${tab}` : null);
  if (site === undefined) return <Loading />;
  if (site === null) return <NotFound />;
  // open issues in fix-first order (Smart Issue Prioritization); resolved ones stay newest first
  const rows = [...(issues.data ?? [])].sort((a, b) =>
    tab === "open" ? ((b.severity === "fail" ? 1 : 0.5) * b.confidence) / b.effort - ((a.severity === "fail" ? 1 : 0.5) * a.confidence) / a.effort : 0,
  );
  return (
    <>
      <PageHeader title="Issues" subtitle="Every problem we've tracked. Open issues are in fix-first order: impact, confidence and effort." />
      <div className="space-y-5 px-6 py-8 lg:px-10">
        <div role="tablist" aria-label="Issue status" className="inline-flex rounded-lg border border-white/[0.1] bg-white/[0.03] p-0.5">
          {(["open", "resolved"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`h-8 cursor-pointer rounded-md px-4 font-sub text-[13px] capitalize transition-colors ${tab === t ? "bg-white/[0.1] text-ink" : "text-ink-3 hover:text-ink"}`}
            >
              {t}
            </button>
          ))}
        </div>
        {!issues.data ? (
          <div className="h-48 animate-pulse rounded-xl bg-white/[0.03]" />
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/[0.1] p-8 text-center font-sub text-[14px] text-ink-3">
            {tab === "open" ? "No open issues. Nice." : "Resolved issues appear here once a later audit confirms the fix."}
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {rows.map((i) => (
              <li key={i.id} className="flex items-center gap-4 bg-[#0d0e0f] px-5 py-3.5">
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
                <span className="w-32 shrink-0 text-right font-sub text-[12.5px] text-ink-3">{i.resolved_at ? `fixed ${ago(i.resolved_at)}` : `since ${ago(i.first_seen_at)}`}</span>
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
      <PageHeader title="Broken links" subtitle="Checked on every scheduled audit, across your own pages and the sites you link to." />
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

const ALERT_ICON = { regression: Rocket, new_issue: CircleAlert, broken_links: LinkIcon } as const;

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
