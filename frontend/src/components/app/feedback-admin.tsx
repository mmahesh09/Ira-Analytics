"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Inbox, Search, X } from "lucide-react";
import { PageHeader } from "./workspace";
import { ApiError } from "@/lib/api";
import {
  EMPTY_FILTERS,
  FEATURES,
  ROLES,
  exportUrl,
  getFeedbackStats,
  labelOf,
  listFeedback,
  type AdminFilters,
  type Count,
  type FeedbackPage,
  type FeedbackRow,
  type FeedbackStats,
  type SortKey,
} from "@/lib/feedback";

type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };

const control =
  "h-10 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 font-sub text-[13.5px] text-ink outline-none transition-colors hover:border-white/20 focus-visible:border-cobalt/70 focus-visible:ring-2 focus-visible:ring-cobalt/25";
const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const dateTimeFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const fmt = (v: number | null, digits = 1) => (v === null ? "—" : v.toFixed(digits));

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Couldn't load feedback. Try again.";
}

export function FeedbackAdmin() {
  const [filters, setFilters] = useState<AdminFilters>(EMPTY_FILTERS);
  const query = useDebounced(filters, 300);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortKey>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [notFound, setNotFound] = useState(false);
  const [open, setOpen] = useState<FeedbackRow | null>(null);
  const [reload, setReload] = useState(0);
  // each result remembers the request it answers; anything else on screen is still loading
  const statsKey = JSON.stringify([query, reload]);
  const listKey = JSON.stringify([query, page, sort, order, reload]);
  const [statsResult, setStatsResult] = useState<{ key: string; load: Load<FeedbackStats> } | null>(null);
  const [listResult, setListResult] = useState<{ key: string; load: Load<FeedbackPage> } | null>(null);
  const stats: Load<FeedbackStats> = statsResult?.key === statsKey ? statsResult.load : { state: "loading" };
  const list: Load<FeedbackPage> = listResult?.key === listKey ? listResult.load : { state: "loading" };

  useEffect(() => {
    let live = true;
    getFeedbackStats(query)
      .then((data) => live && setStatsResult({ key: statsKey, load: { state: "ready", data } }))
      .catch((e) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        setStatsResult({ key: statsKey, load: { state: "error", message: errorMessage(e) } });
      });
    return () => {
      live = false;
    };
  }, [query, statsKey]);

  useEffect(() => {
    let live = true;
    listFeedback(query, page, sort, order)
      .then((data) => live && setListResult({ key: listKey, load: { state: "ready", data } }))
      .catch((e) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        setListResult({ key: listKey, load: { state: "error", message: errorMessage(e) } });
      });
    return () => {
      live = false;
    };
  }, [query, page, sort, order, listKey]);

  function update<K extends keyof AdminFilters>(key: K, value: AdminFilters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function clear() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  function sortBy(key: SortKey) {
    if (sort === key) setOrder((o) => (o === "desc" ? "asc" : "desc"));
    else {
      setSort(key);
      setOrder("desc");
    }
    setPage(1);
  }

  const filtered = Object.values(filters).some(Boolean);

  if (notFound) {
    return (
      <>
        <PageHeader title="Not found" />
        <p className="px-6 py-8 font-sub text-[14px] text-ink-3 lg:px-10">This page doesn&apos;t exist, or your account can&apos;t open it.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Product feedback"
        subtitle="Answers from the public feedback form. Only admins can see this page."
        actions={
          <a href={exportUrl(query)} download className="btn-ghost inline-flex h-9 items-center gap-2 rounded-lg px-3.5 font-sub text-[13.5px]">
            <Download aria-hidden="true" className="size-4" /> Export CSV
          </a>
        }
      />
      <div className="max-w-[1240px] space-y-6 px-6 py-8 lg:px-10">
        <Filters filters={filters} onChange={update} onClear={clear} filtered={filtered} />

        {stats.state === "error" ? <ErrorBox message={stats.message} onRetry={() => setReload((n) => n + 1)} /> : <Summary stats={stats.state === "ready" ? stats.data : null} />}

        <section aria-labelledby="fb-table" className="rounded-xl border border-line">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 id="fb-table" className="font-sub text-[15px] font-medium">
              Submissions
            </h2>
            {list.state === "ready" && (
              <p className="font-sub text-[13px] text-ink-3" aria-live="polite">
                {list.data.total.toLocaleString()} {list.data.total === 1 ? "response" : "responses"}
                {filtered ? " match these filters" : ""}
              </p>
            )}
          </div>
          {list.state === "error" ? (
            <div className="p-4">
              <ErrorBox message={list.message} onRetry={() => setReload((n) => n + 1)} />
            </div>
          ) : (
            <Table data={list.state === "ready" ? list.data : null} sort={sort} order={order} onSort={sortBy} onOpen={setOpen} filtered={filtered} page={page} onPage={setPage} />
          )}
        </section>
      </div>
      <Detail row={open} onClose={() => setOpen(null)} />
    </>
  );
}

function Filters({
  filters,
  onChange,
  onClear,
  filtered,
}: {
  filters: AdminFilters;
  onChange: <K extends keyof AdminFilters>(key: K, value: AdminFilters[K]) => void;
  onClear: () => void;
  filtered: boolean;
}) {
  return (
    <section aria-label="Filters" className="flex flex-wrap items-end gap-3">
      <label className="relative min-w-[220px] flex-1">
        <span className="sr-only">Search feedback</span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
        <input type="search" value={filters.q} onChange={(e) => onChange("q", e.target.value)} placeholder="Search comments, names, emails" maxLength={200} className={`${control} w-full pl-9`} />
      </label>
      <label className="grid gap-1 font-sub text-[12px] text-ink-3">
        From
        <input type="date" value={filters.date_from} max={filters.date_to || undefined} onChange={(e) => onChange("date_from", e.target.value)} className={control} />
      </label>
      <label className="grid gap-1 font-sub text-[12px] text-ink-3">
        To
        <input type="date" value={filters.date_to} min={filters.date_from || undefined} onChange={(e) => onChange("date_to", e.target.value)} className={control} />
      </label>
      <label className="grid gap-1 font-sub text-[12px] text-ink-3">
        Role
        <select value={filters.role} onChange={(e) => onChange("role", e.target.value as AdminFilters["role"])} className={control}>
          <option value="">All roles</option>
          {ROLES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 font-sub text-[12px] text-ink-3">
        Satisfaction
        <select value={filters.min_rating} onChange={(e) => onChange("min_rating", e.target.value)} className={control}>
          <option value="">Any rating</option>
          {[5, 4, 3, 2].map((n) => (
            <option key={n} value={n}>
              {n === 5 ? "5 stars" : `${n}+ stars`}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 font-sub text-[12px] text-ink-3">
        Feature used
        <select value={filters.feature} onChange={(e) => onChange("feature", e.target.value as AdminFilters["feature"])} className={control}>
          <option value="">Any feature</option>
          {FEATURES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {filtered && (
        <button type="button" onClick={onClear} className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3 font-sub text-[13.5px] text-ink-2 hover:bg-white/[0.05] hover:text-ink">
          <X aria-hidden="true" className="size-4" /> Clear
        </button>
      )}
    </section>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-md bg-white/[0.06] ${className}`} />;
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bad/30 bg-bad-soft p-4">
      <p className="flex items-center gap-2 font-sub text-[14px] text-ink-2">
        <AlertCircle aria-hidden="true" className="size-4 shrink-0 text-[#f87171]" /> {message}
      </p>
      <button type="button" onClick={onRetry} className="btn-ghost inline-flex h-9 cursor-pointer items-center rounded-lg px-3.5 font-sub text-[13.5px]">
        Try again
      </button>
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="panel rounded-xl p-5">
      <p className="font-sub text-[12.5px] text-ink-3">{label}</p>
      <div className="mt-2 font-display text-[30px] font-semibold tracking-[-0.03em]">{value}</div>
      {note && <p className="mt-1 font-sub text-[12.5px] text-ink-3">{note}</p>}
    </div>
  );
}

function OutOf({ value, max }: { value: number | null; max: number }) {
  return (
    <>
      {fmt(value)}
      <span className="text-[16px] text-ink-3"> / {max}</span>
    </>
  );
}

function Summary({ stats }: { stats: FeedbackStats | null }) {
  const busy = <Skeleton className="h-8 w-20" />;
  const nps = stats?.nps;
  return (
    <div className="space-y-6" aria-busy={!stats}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Responses" value={stats ? stats.total.toLocaleString() : busy} note={stats ? `${stats.feature_requests} with a feature request` : undefined} />
        <Tile label="Avg. satisfaction" value={stats ? <OutOf value={stats.avg_satisfaction} max={5} /> : busy} />
        <Tile label="Avg. ease of use" value={stats ? <OutOf value={stats.avg_usability} max={5} /> : busy} />
        <Tile
          label="Avg. likely to recommend"
          value={stats ? <OutOf value={stats.avg_recommendation} max={10} /> : busy}
          note={nps !== null && nps !== undefined ? `NPS ${nps > 0 ? "+" : ""}${nps}` : undefined}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Trend stats={stats} />
        <Requests stats={stats} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <TopList title="Biggest challenges" items={stats?.top_challenges} total={stats?.total} />
        <TopList title="Most valued features" items={stats?.top_valued_features} total={stats?.total} />
        <TopList title="Features used" items={stats?.features_used} total={stats?.total} />
      </div>
    </div>
  );
}

function Trend({ stats }: { stats: FeedbackStats | null }) {
  const days = stats?.trend ?? [];
  const max = Math.max(1, ...days.map((d) => d.count));
  const sum = days.reduce((n, d) => n + d.count, 0);
  const W = 600;
  const H = 140;
  const gap = 3;
  const bar = days.length ? (W - gap * (days.length - 1)) / days.length : 0;
  const day = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00`));
  return (
    <section aria-labelledby="fb-trend" className="rounded-xl border border-line p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="fb-trend" className="font-sub text-[15px] font-medium">
          Last 30 days
        </h2>
        {stats && <p className="font-sub text-[12.5px] text-ink-3">{sum} responses</p>}
      </div>
      {!stats ? (
        <Skeleton className="mt-4 h-[140px] w-full" />
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-[140px] w-full" preserveAspectRatio="none" role="img" aria-label={`Daily responses over the last 30 days: ${sum} in total, at most ${max} in one day`}>
            <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} stroke="rgb(255 255 255 / 0.1)" />
            {days.map((d, i) => {
              const h = d.count ? Math.max(3, (d.count / max) * (H - 8)) : 0;
              return (
                <rect key={d.date} x={i * (bar + gap)} y={H - h} width={bar} height={h} rx="2" fill="var(--cobalt-fill)">
                  <title>{`${day(d.date)}: ${d.count}`}</title>
                </rect>
              );
            })}
          </svg>
          <div className="mt-2 flex justify-between font-mono text-[11px] text-ink-3" aria-hidden="true">
            <span>{days[0] ? day(days[0].date) : ""}</span>
            <span>Today</span>
          </div>
        </>
      )}
    </section>
  );
}

function Requests({ stats }: { stats: FeedbackStats | null }) {
  return (
    <section aria-labelledby="fb-requests" className="rounded-xl border border-line p-5">
      <h2 id="fb-requests" className="font-sub text-[15px] font-medium">
        Latest feature requests
      </h2>
      {!stats ? (
        <div className="mt-4 space-y-2.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : stats.recent_requests.length ? (
        <ul className="mt-3 space-y-2.5">
          {stats.recent_requests.map((r) => (
            <li key={r.id} className="border-l-2 border-cobalt/50 pl-3">
              <p className="line-clamp-2 break-words font-sub text-[13.5px] text-ink-2">{r.text}</p>
              <p className="mt-0.5 font-mono text-[11px] text-ink-3">{dateFmt.format(new Date(r.created_at))}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 font-sub text-[13.5px] text-ink-3">No feature requests yet.</p>
      )}
    </section>
  );
}

function TopList({ title, items, total }: { title: string; items?: Count[]; total?: number }) {
  const max = Math.max(1, ...(items ?? []).map((i) => i.count));
  return (
    <section aria-label={title} className="rounded-xl border border-line p-5">
      <h2 className="font-sub text-[15px] font-medium">{title}</h2>
      {!items ? (
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : items.length ? (
        <ol className="mt-4 space-y-3">
          {items.slice(0, 6).map((item) => (
            <li key={item.value}>
              <div className="flex justify-between gap-3 font-sub text-[13px]">
                <span className="truncate text-ink-2">{labelOf(item.value)}</span>
                <span className="shrink-0 font-mono text-[12px] text-ink-3">
                  {item.count}
                  {total ? <span className="sr-only"> of {total} responses</span> : null}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06]" aria-hidden="true">
                <div className="h-full rounded-full bg-cobalt" style={{ width: `${(item.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 font-sub text-[13.5px] text-ink-3">Nothing yet.</p>
      )}
    </section>
  );
}

const SORTABLE: { key: SortKey; label: string }[] = [
  { key: "created_at", label: "Date" },
  { key: "satisfaction_rating", label: "Satisfaction" },
  { key: "usability_rating", label: "Ease" },
  { key: "recommendation_score", label: "Recommend" },
];

function Table({
  data,
  sort,
  order,
  onSort,
  onOpen,
  filtered,
  page,
  onPage,
}: {
  data: FeedbackPage | null;
  sort: SortKey;
  order: "asc" | "desc";
  onSort: (key: SortKey) => void;
  onOpen: (row: FeedbackRow) => void;
  filtered: boolean;
  page: number;
  onPage: (page: number) => void;
}) {
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const th = "px-4 py-2.5 text-left font-sub text-[12px] font-medium uppercase tracking-[0.06em] text-ink-3";

  if (data && data.items.length === 0) {
    return (
      <div className="grid place-items-center px-6 py-14 text-center">
        <Inbox aria-hidden="true" className="size-8 text-ink-3" />
        <p className="mt-3 font-sub text-[14.5px] text-ink-2">{filtered ? "No feedback matches these filters." : "No feedback yet."}</p>
        <p className="mt-1 font-sub text-[13px] text-ink-3">{filtered ? "Try a wider date range or clear the filters." : "Share /feedback with your users. Answers appear here as they arrive."}</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead className="border-b border-line">
            <tr>
              <SortHeader col={SORTABLE[0]} sort={sort} order={order} onSort={onSort} className={th} />
              <th scope="col" className={th}>
                Role
              </th>
              {SORTABLE.slice(1).map((c) => (
                <SortHeader key={c.key} col={c} sort={sort} order={order} onSort={onSort} className={th} />
              ))}
              <th scope="col" className={th}>
                Challenge
              </th>
              <th scope="col" className={th}>
                Comment
              </th>
            </tr>
          </thead>
          <tbody aria-busy={!data}>
            {!data
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    {Array.from({ length: 7 }, (_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : data.items.map((row) => {
                  const comment = row.improvement_suggestions || row.requested_feature || row.positive_feedback || row.additional_comments;
                  return (
                    <tr key={row.id} className="border-b border-line font-sub text-[13.5px] transition-colors last:border-0 hover:bg-white/[0.025]">
                      <td className="whitespace-nowrap px-4 py-3">
                        <button type="button" onClick={() => onOpen(row)} className="cursor-pointer text-left text-ink underline-offset-4 hover:underline">
                          {dateFmt.format(new Date(row.created_at))}
                          <span className="sr-only">, open response #{row.id}</span>
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-2">{row.role === "other" ? row.role_other : labelOf(row.role)}</td>
                      <td className="px-4 py-3 font-mono text-ink-2">{row.satisfaction_rating}/5</td>
                      <td className="px-4 py-3 font-mono text-ink-2">{row.usability_rating}/5</td>
                      <td className="px-4 py-3 font-mono text-ink-2">{row.recommendation_score}/10</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-ink-2">{row.biggest_challenge === "other" ? row.biggest_challenge_other : labelOf(row.biggest_challenge)}</td>
                      <td className="max-w-[280px] truncate px-4 py-3 text-ink-3">{comment || "—"}</td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
      {data && pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
          <p className="font-sub text-[13px] text-ink-3">
            Page {page} of {pages}
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="btn-ghost inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg px-3 font-sub text-[13px]">
              <ChevronLeft aria-hidden="true" className="size-4" /> Previous
            </button>
            <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="btn-ghost inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg px-3 font-sub text-[13px]">
              Next <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        </nav>
      )}
    </>
  );
}

function SortHeader({
  col,
  sort,
  order,
  onSort,
  className,
}: {
  col: { key: SortKey; label: string };
  sort: SortKey;
  order: "asc" | "desc";
  onSort: (key: SortKey) => void;
  className: string;
}) {
  const active = sort === col.key;
  const Icon = order === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (order === "asc" ? "ascending" : "descending") : "none"} className={className}>
      <button type="button" onClick={() => onSort(col.key)} className={`inline-flex cursor-pointer items-center gap-1 uppercase hover:text-ink ${active ? "text-ink" : ""}`}>
        {col.label}
        {active && <Icon aria-hidden="true" className="size-3.5" />}
      </button>
    </th>
  );
}

function Detail({ row, onClose }: { row: FeedbackRow | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (row && !dialog.open) dialog.showModal();
    if (!row && dialog.open) dialog.close();
  }, [row]);

  const fields = useMemo<[string, ReactNode][]>(() => {
    if (!row) return [];
    const withOther = (value: string, other: string | null) => (value === "other" ? `Other: ${other ?? ""}` : labelOf(value));
    return [
      ["Received", dateTimeFmt.format(new Date(row.created_at))],
      ["Name", row.name || "—"],
      [
        "Email",
        row.email ? (
          <a href={`mailto:${row.email}`} className="text-cobalt underline-offset-4 hover:underline">
            {row.email}
          </a>
        ) : (
          "—"
        ),
      ],
      ["May contact", row.contact_permission ? "Yes, about this feedback" : "No"],
      ["Role", withOther(row.role, row.role_other)],
      ["Usage", labelOf(row.usage_frequency)],
      ["Satisfaction", `${row.satisfaction_rating} / 5`],
      ["Ease of use", `${row.usability_rating} / 5`],
      ["Likely to recommend", `${row.recommendation_score} / 10`],
      ["Main goal", withOther(row.primary_goal, row.primary_goal_other)],
      ["Features used", row.features_used.length ? row.features_used.map(labelOf).join(", ") : "—"],
      ["Most valuable", labelOf(row.most_valuable_feature)],
      ["Biggest challenge", withOther(row.biggest_challenge, row.biggest_challenge_other)],
      ["Likes most", row.positive_feedback || "—"],
      ["Should improve", row.improvement_suggestions || "—"],
      ["Feature request", row.requested_feature || "—"],
      ["Other comments", row.additional_comments || "—"],
    ];
  }, [row]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="fb-detail-title"
      className="m-auto w-[min(680px,calc(100vw-32px))] rounded-2xl border border-line-strong bg-surface p-0 text-ink shadow-[var(--shadow-lg)] backdrop:bg-black/70"
    >
      {row && (
        <div className="max-h-[85vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-[11px]">Response #{row.id}</p>
              <h2 id="fb-detail-title" className="mt-2 text-[20px] font-semibold tracking-[-0.02em]">
                {row.name || "Anonymous"}
              </h2>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 cursor-pointer place-items-center rounded-full text-ink-2 hover:bg-white/[0.06] hover:text-ink">
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <dl className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-[170px_1fr]">
            {fields.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-sub text-[13px] text-ink-3">{k}</dt>
                <dd className="whitespace-pre-line break-words font-sub text-[14px] text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </dialog>
  );
}
