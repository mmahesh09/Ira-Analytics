"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ArrowUpRight, Check, CircleAlert, CircleDot, Copy, Globe, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { MODULES } from "@/lib/format";
import { EFFORT_LABEL } from "@/lib/scoring";
import type { AuditPoint, IssueRow, Site, SiteStatus } from "@/lib/types";
import { HealthStats, HistoryChart, byPriority, useApi } from "./monitoring";
import { Loading, NotFound, PageHeader, useSite, useWorkspace } from "./workspace";

const input =
  "h-10 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 font-sub text-[14px] text-ink outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-ink-3 focus-visible:border-white/25 focus-visible:shadow-[0_0_0_4px_rgb(255_255_255/0.05)] focus-visible:outline-none";
const primary =
  "btn-brand inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 font-sub text-[13.5px] font-medium disabled:cursor-wait disabled:opacity-70";
const secondary = "btn-ghost inline-flex h-9 cursor-pointer items-center gap-2 rounded-full px-3.5 font-sub text-[13px]";

function AddSiteForm({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const { reload } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const site = await apiFetch<Site>("/sites", { body: { domain: form.get("domain"), name: form.get("name") } });
      await reload();
      onDone?.();
      router.push(`/app/${site.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the site.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel rounded-xl p-6">
      <h2 className="text-[17px] font-medium tracking-[-0.01em]">Add a site</h2>
      <p className="mt-1 text-[14px] text-ink-3">Light checks start on their own. Run a full audit whenever you want the complete picture.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-[1.4fr_1fr_auto]">
        <label className="sr-only" htmlFor="site-domain">
          Domain
        </label>
        <input id="site-domain" name="domain" required placeholder="example.com" autoFocus className={input} />
        <label className="sr-only" htmlFor="site-name">
          Display name
        </label>
        <input id="site-name" name="name" placeholder="Name (optional)" className={input} />
        <button type="submit" disabled={pending} className={`${primary} h-10 justify-center`}>
          {pending ? "Adding…" : "Add site"}
        </button>
      </div>
      <p role="alert" className="mt-2 min-h-5 font-sub text-[13px] text-bad">
        {error}
      </p>
    </form>
  );
}

export function SitesHome() {
  const { sites } = useWorkspace();
  const params = useSearchParams();
  const [adding, setAdding] = useState(params.get("add") === "1");

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Sites"
        subtitle="Every site you track, in one place."
        actions={
          sites?.length ? (
            <button type="button" onClick={() => setAdding((a) => !a)} className={primary}>
              <Plus aria-hidden="true" className="size-4" /> Add site
            </button>
          ) : null
        }
      />
      <div className="space-y-6 px-6 py-8 lg:px-10">
        {sites === null ? (
          <Loading />
        ) : (
          <>
            {(adding || params.get("add") === "1" || sites.length === 0) && <AddSiteForm onDone={() => setAdding(false)} />}
            {sites.length > 0 && (
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {sites.map((s) => (
                  <li key={s.id}>
                    <Link href={`/app/${s.id}`} className="panel group flex h-full flex-col rounded-xl p-5 transition-colors duration-200 hover:border-white/[0.16]">
                      <span className="flex items-center justify-between">
                        <span className="grid size-8 place-items-center rounded-lg bg-white/[0.06] font-sub text-[13px] font-medium uppercase">{s.domain[0]}</span>
                        <ArrowUpRight aria-hidden="true" className="size-4 text-ink-3 transition-colors group-hover:text-ink" />
                      </span>
                      <span className="mt-4 truncate text-[16px] font-medium">{s.name}</span>
                      <span className="truncate font-sub text-[13px] text-ink-3">{s.domain}</span>
                      <span className="mt-4 font-sub text-[12px] text-ink-3">Light checks: {s.audit_cadence === "off" ? "paused" : s.audit_cadence}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}

/** Top open issues in fix-first order, linking through to the full list. */
function FixFirst({ siteId, issues }: { siteId: number; issues: IssueRow[] | null }) {
  const top = issues ? [...issues].sort(byPriority).slice(0, 5) : null;
  return (
    <section className="panel min-w-0 rounded-xl p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-medium tracking-[-0.01em]">Fix these first</h2>
        <Link href={`/app/${siteId}/issues`} className="inline-flex items-center gap-1 font-sub text-[13px] text-ink-3 hover:text-ink">
          All issues <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
      <p className="mt-1 text-[14px] text-ink-3">Ranked by impact, confidence and effort.</p>
      {!top ? (
        <div className="mt-5 h-40 animate-pulse rounded-lg bg-white/[0.03]" />
      ) : top.length === 0 ? (
        <p className="mt-5 rounded-lg border border-good/30 bg-good-soft p-4 font-sub text-[13.5px] text-good">No open issues. Nice.</p>
      ) : (
        <ol className="mt-5 space-y-2">
          {top.map((i, n) => (
            <li key={i.id} className="flex items-start gap-3 rounded-lg border border-line bg-white/[0.015] px-3 py-2.5">
              <span className="mt-0.5 font-code text-[11px] text-cobalt">{String(n + 1).padStart(2, "0")}</span>
              {i.severity === "fail" ? <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-bad" /> : <CircleDot aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warn" />}
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] leading-snug text-ink">{i.title}</span>
                <span className="font-sub text-[12px] text-ink-3">
                  {MODULES[i.module]?.label ?? i.module} · {EFFORT_LABEL[i.effort] ?? ""}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function SiteOverview() {
  const site = useSite();
  const id = site?.id;
  const history = useApi<AuditPoint[]>(id ? `/sites/${id}/history` : null);
  const issues = useApi<IssueRow[]>(id ? `/sites/${id}/issues?status=open` : null);
  const status = useApi<SiteStatus>(id ? `/sites/${id}/status` : null);
  if (site === undefined) return <Loading />;
  if (site === null) return <NotFound />;
  const points = history.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={site.name}
        subtitle={
          <a href={`https://${site.domain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-ink">
            <Globe aria-hidden="true" className="size-3.5" /> {site.domain}
          </a>
        }
        actions={
          <Link href={`/audit?url=${encodeURIComponent(`https://${site.domain}/`)}`} className={primary}>
            Full report <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        }
      />
      <div className="space-y-6 px-6 py-8 lg:px-10">
        <HealthStats points={points} open={issues.data} status={status.data} cadence={site.audit_cadence} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <section className="panel min-w-0 rounded-xl p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[17px] font-medium tracking-[-0.01em]">Health trend</h2>
              <Link href={`/app/${site.id}/monitoring`} className="inline-flex items-center gap-1 font-sub text-[13px] text-ink-3 hover:text-ink">
                Monitoring <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            </div>
            <div className="mt-5">
              {points.length >= 2 ? (
                <HistoryChart points={points} height={220} />
              ) : (
                <div className="grid h-[220px] place-items-center rounded-lg border border-dashed border-white/[0.1] text-center">
                  <p className="max-w-[36ch] font-sub text-[13.5px] text-ink-3">
                    {points.length ? "One audit so far. The trend appears after the next one." : "No audits yet. Run one from Monitoring to start the history."}
                  </p>
                </div>
              )}
            </div>
          </section>
          <FixFirst siteId={site.id} issues={issues.data} />
        </div>

        <section className="panel min-w-0 rounded-xl p-6">
          <h2 className="text-[17px] font-medium tracking-[-0.01em]">Schedule</h2>
          <p className="mt-1 max-w-[70ch] text-[14px] text-ink-3">
            Light checks re-run the SEO, AEO and GEO rules on a schedule and never use credits. Speed and broken links are measured by full audits.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 font-sub text-[14px]">
            <p className="flex items-center gap-2">
              <span className="eyebrow text-[10.5px]">Light checks</span>
              <span className="rounded-full border border-cobalt/30 bg-cobalt-soft px-2.5 py-0.5 text-ink">
                {site.audit_cadence === "off" ? "Paused" : site.audit_cadence === "daily" ? "Daily" : "Weekly"}
              </span>
            </p>
            <p className="flex items-center gap-2">
              <span className="eyebrow text-[10.5px]">Monthly full audit</span>
              <span className="rounded-full border border-line-strong px-2.5 py-0.5 text-ink-2">{site.auto_full_audit ? "On · 1 credit" : "Off"}</span>
            </p>
          </div>
          <Link href={`/app/${site.id}/settings`} className="mt-4 inline-flex items-center gap-1.5 font-sub text-[13.5px] text-ink-3 hover:text-ink">
            Change in settings <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </section>
      </div>
    </>
  );
}

/** Change Detective: a secret URL CI/CD calls after each release to audit the site straight away. */
function DeployHookCard({ siteId }: { siteId: number }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    apiFetch<{ url: string | null }>(`/sites/${siteId}/deploy-hook`)
      .then((r) => live && setUrl(r.url))
      .catch(() => live && setUrl(null));
    return () => {
      live = false;
    };
  }, [siteId]);

  async function rotate() {
    if (url && !window.confirm("Create a new URL? The current one will stop working.")) return;
    setUrl((await apiFetch<{ url: string }>(`/sites/${siteId}/deploy-hook`, { method: "POST" })).url);
  }
  async function remove() {
    await apiFetch(`/sites/${siteId}/deploy-hook`, { method: "DELETE" });
    setUrl(null);
  }

  return (
    <section className="panel rounded-xl p-6">
      <h2 className="text-[17px] font-medium tracking-[-0.01em]">Check after each deploy</h2>
      <p className="mt-1 max-w-[60ch] text-[14px] text-ink-3">
        Call this URL from your CI/CD (Vercel, Netlify, GitHub Actions) when a release goes live. We run a full audit (1 credit), or a free light check when
        you&rsquo;re out of credits, and alert you if something broke. At most once an hour per site.
      </p>
      {url === undefined ? (
        <div className="mt-5 h-10 animate-pulse rounded-lg bg-white/[0.04]" />
      ) : url ? (
        <>
          <div className="mt-5 flex gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-white/[0.08] bg-surface-ink/70 px-3 py-2.5 font-mono text-[12.5px] text-ink-2">{url}</code>
            <button
              type="button"
              onClick={() =>
                navigator.clipboard?.writeText(url).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                })
              }
              className={secondary}
            >
              {copied ? <Check aria-hidden="true" className="size-4 text-good" /> : <Copy aria-hidden="true" className="size-4" />}
              <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-surface-ink/70 px-3 py-2 font-mono text-[12px] text-ink-3">curl -X POST {url}</pre>
          <div className="mt-4 flex gap-4 font-sub text-[13px]">
            <button type="button" onClick={rotate} className="cursor-pointer text-ink-3 hover:text-ink">
              Create a new URL
            </button>
            <button type="button" onClick={remove} className="cursor-pointer text-ink-3 hover:text-bad">
              Turn off
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={rotate} className={`${primary} mt-5`}>
          Create deploy URL
        </button>
      )}
    </section>
  );
}

const CADENCES: { value: Site["audit_cadence"]; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "off", label: "Off" },
];

export function SiteSettings() {
  const site = useSite();
  const router = useRouter();
  const { reload } = useWorkspace();
  const [status, setStatus] = useState<string | null>(null);
  const [cadence, setCadence] = useState<Site["audit_cadence"] | null>(null);
  const [autoFull, setAutoFull] = useState<boolean | null>(null);

  if (site === undefined) return <Loading />;
  if (site === null) return <NotFound />;
  const current = cadence ?? site.audit_cadence;
  const monthlyAudit = autoFull ?? site.auto_full_audit;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!site) return;
    const form = new FormData(event.currentTarget);
    setStatus("Saving…");
    try {
      await apiFetch(`/sites/${site.id}`, { method: "PATCH", body: { name: form.get("name"), audit_cadence: current, auto_full_audit: monthlyAudit } });
      await reload();
      setStatus("Saved");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Couldn't save.");
    }
  }

  async function remove() {
    if (!site || !window.confirm(`Delete ${site.domain} and all of its data? This can't be undone.`)) return;
    await apiFetch(`/sites/${site.id}`, { method: "DELETE" });
    await reload();
    router.replace("/app");
  }

  return (
    <>
      <PageHeader eyebrow={site.domain} title="Settings" subtitle="Audit schedule, deploy hook and site details." />
      <div className="max-w-[720px] space-y-4 px-6 py-8 lg:px-10">
        <form onSubmit={save} className="panel space-y-6 rounded-xl p-6">
          <div>
            <label htmlFor="name" className="font-sub text-[13px] text-ink-2">
              Display name
            </label>
            <input id="name" name="name" defaultValue={site.name} required maxLength={120} className={`${input} mt-1.5`} />
          </div>
          <fieldset>
            <legend className="font-sub text-[13px] text-ink-2">Scheduled light checks</legend>
            <p className="mt-0.5 font-sub text-[12.5px] text-ink-3">Free. Free plans check weekly at most; paid plans can check daily.</p>
            <div role="radiogroup" className="mt-1.5 inline-flex rounded-lg border border-white/[0.1] bg-white/[0.03] p-0.5">
              {CADENCES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={current === c.value}
                  onClick={() => setCadence(c.value)}
                  className={`h-8 cursor-pointer rounded-md px-4 font-sub text-[13px] transition-colors duration-150 ${current === c.value ? "bg-white/[0.1] text-ink" : "text-ink-3 hover:text-ink"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={monthlyAudit}
              onChange={(e) => setAutoFull(e.target.checked)}
              className="mt-0.5 size-4 cursor-pointer accent-[#9333ea]"
            />
            <span>
              <span className="block font-sub text-[13.5px] text-ink">Run a full audit every month</span>
              <span className="block font-sub text-[12.5px] text-ink-3">Uses 1 audit credit a month. If you&rsquo;re out of credits it&rsquo;s skipped and you get an alert.</span>
            </span>
          </label>
          <div className="flex items-center gap-3">
            <button type="submit" className={primary}>
              Save changes
            </button>
            <span aria-live="polite" className="font-sub text-[13px] text-ink-3">
              {status}
            </span>
          </div>
        </form>

        <DeployHookCard siteId={site.id} />

        <section className="rounded-xl border border-bad/25 p-6">
          <h2 className="text-[17px] font-medium tracking-[-0.01em]">Delete site</h2>
          <p className="mt-1 text-[14px] text-ink-3">Removes the site with its audits, issues, link checks and alerts. Credits already used aren&rsquo;t refunded.</p>
          <button type="button" onClick={remove} className="mt-4 inline-flex h-9 cursor-pointer items-center rounded-lg border border-bad/40 px-3.5 font-sub text-[13.5px] text-bad transition-colors hover:bg-bad-soft">
            Delete {site.domain}
          </button>
        </section>
      </div>
    </>
  );
}
