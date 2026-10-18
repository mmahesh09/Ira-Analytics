"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ArrowUpRight, Check, Copy, Globe, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Site } from "@/lib/types";
import { useWorkspace } from "./app-shell";

const input =
  "h-10 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 font-sub text-[14px] text-ink outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-ink-3 focus-visible:border-white/25 focus-visible:shadow-[0_0_0_4px_rgb(255_255_255/0.05)] focus-visible:outline-none";
const primary =
  "inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-ink px-3.5 font-sub text-[13.5px] font-medium text-paper transition-colors duration-150 hover:bg-white disabled:cursor-wait disabled:opacity-70";
const secondary =
  "inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3.5 font-sub text-[13.5px] text-ink-2 transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-6 pb-6 pt-8 lg:px-10">
      <div className="min-w-0">
        <h1 className="truncate text-[26px] font-semibold tracking-[-0.03em]">{title}</h1>
        {subtitle && <p className="mt-1 font-sub text-[14px] text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  );
}

export function useSite(): Site | null | undefined {
  const { siteId } = useParams<{ siteId: string }>();
  const { sites } = useWorkspace();
  if (sites === null) return undefined; // loading
  return sites.find((s) => String(s.id) === siteId) ?? null;
}

export function Loading() {
  return <div className="m-10 h-40 animate-pulse rounded-xl bg-white/[0.03]" />;
}

export function NotFound() {
  return (
    <div className="px-6 py-24 text-center lg:px-10">
      <p className="text-[18px] font-medium">Site not found</p>
      <Link href="/app" className="mt-3 inline-block font-sub text-[14px] text-ink-3 hover:text-ink">
        Back to sites
      </Link>
    </div>
  );
}

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
      <p className="mt-1 text-[14px] text-ink-3">You&apos;ll get a one-line tracking snippet next.</p>
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
                      <span className="mt-4 font-sub text-[12px] text-ink-3">Audits: {s.audit_cadence === "off" ? "manual" : s.audit_cadence}</span>
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

function SnippetCard({ site }: { site: Site }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="panel rounded-xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-medium tracking-[-0.01em]">Install the tracking script</h2>
          <p className="mt-1 max-w-[60ch] text-[14px] text-ink-3">
            Paste this into the <code className="font-mono text-ink-2">&lt;head&gt;</code> of every page on {site.domain}. It&apos;s under 1 KB, sets no cookies and stores no IP addresses.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            navigator.clipboard?.writeText(site.snippet).then(() => {
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
      <pre className="mt-5 overflow-x-auto rounded-lg border border-white/[0.06] bg-surface-ink/70 px-4 py-3 font-[ui-monospace,SFMono-Regular,Menlo,Consolas,monospace] text-[12.5px] leading-relaxed text-ink-2">
        {site.snippet}
      </pre>
    </section>
  );
}

export function SiteOverview() {
  const site = useSite();
  if (site === undefined) return <Loading />;
  if (site === null) return <NotFound />;

  return (
    <>
      <PageHeader
        title={site.name}
        subtitle={
          <a href={`https://${site.domain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-ink">
            <Globe aria-hidden="true" className="size-3.5" /> {site.domain}
          </a>
        }
        actions={
          <Link href={`/audit?url=${encodeURIComponent(`https://${site.domain}/`)}`} className={primary}>
            Run audit <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        }
      />
      <div className="grid gap-4 px-6 py-8 lg:px-10 xl:grid-cols-[1.6fr_1fr]">
        <SnippetCard site={site} />
        <section className="panel rounded-xl p-6">
          <h2 className="text-[17px] font-medium tracking-[-0.01em]">Scheduled audits</h2>
          <p className="mt-1 text-[14px] text-ink-3">SEO, AEO, GEO and Speed are re-checked automatically so you see trends, not snapshots.</p>
          <p className="mt-5 font-sub text-[14px]">
            Cadence: <span className="text-ink">{site.audit_cadence === "off" ? "Off" : site.audit_cadence === "daily" ? "Daily" : "Weekly"}</span>
          </p>
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
      <h2 className="text-[17px] font-medium tracking-[-0.01em]">Audit after every deploy</h2>
      <p className="mt-1 max-w-[60ch] text-[14px] text-ink-3">
        Call this URL from your CI/CD (Vercel, Netlify, GitHub Actions) when a release goes live. We audit right away and alert you if something broke.
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

  if (site === undefined) return <Loading />;
  if (site === null) return <NotFound />;
  const current = cadence ?? site.audit_cadence;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!site) return;
    const form = new FormData(event.currentTarget);
    setStatus("Saving…");
    try {
      await apiFetch(`/sites/${site.id}`, { method: "PATCH", body: { name: form.get("name"), audit_cadence: current } });
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
      <PageHeader title="Settings" subtitle={site.domain} />
      <div className="max-w-[720px] space-y-4 px-6 py-8 lg:px-10">
        <form onSubmit={save} className="panel space-y-6 rounded-xl p-6">
          <div>
            <label htmlFor="name" className="font-sub text-[13px] text-ink-2">
              Display name
            </label>
            <input id="name" name="name" defaultValue={site.name} required maxLength={120} className={`${input} mt-1.5`} />
          </div>
          <fieldset>
            <legend className="font-sub text-[13px] text-ink-2">Scheduled audits</legend>
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
          <p className="mt-1 text-[14px] text-ink-3">Removes the site, its traffic data, audits and AI-visibility history.</p>
          <button type="button" onClick={remove} className="mt-4 inline-flex h-9 cursor-pointer items-center rounded-lg border border-bad/40 px-3.5 font-sub text-[13.5px] text-bad transition-colors hover:bg-bad-soft">
            Delete {site.domain}
          </button>
        </section>
      </div>
    </>
  );
}
