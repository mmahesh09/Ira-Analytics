"use client";

import { useState } from "react";
import { Check as CheckIcon, KeyRound, X } from "lucide-react";
import { compact } from "@/lib/format";
import type { Crawler, KeywordRow, LabMetric, ModuleResult, Probe } from "@/lib/types";
import { COLOR, PositionsChart, SplitDonut } from "./charts";
import { LengthMeter } from "./infographics";

function Card({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="panel rounded-xl p-5 sm:p-6">
      <h4 className="text-[16px] font-medium tracking-[-0.01em]">{title}</h4>
      {note && <p className="mt-1 text-[13.5px] text-ink-3">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SeoExtras({ module, url }: { module: ModuleResult; url: string }) {
  const d = module.data as { title?: string; description?: string; word_count?: number; page_size_kb?: number; internal_links?: number; external_links?: number };
  const host = (() => {
    try {
      const u = new URL(url);
      return u.hostname + (u.pathname === "/" ? "" : u.pathname);
    } catch {
      return url;
    }
  })();
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card title="Search result preview" note="Approximately how Google may display this page.">
        <div className="rounded-lg border border-line bg-paper p-4">
          <p className="truncate text-sm text-ink-3">{host}</p>
          <p className="mt-1 line-clamp-1 text-xl font-sub text-[#8ab4f8]">{d.title || "Untitled page"}</p>
          <p className="mt-1 line-clamp-2 text-sm text-ink-2">{d.description || "No meta description, so Google will pick text from the page instead."}</p>
        </div>
        <div className="mt-5 space-y-4">
          <LengthMeter label="Title" length={d.title?.length ?? 0} ideal={[30, 60]} max={80} />
          <LengthMeter label="Meta description" length={d.description?.length ?? 0} ideal={[70, 160]} max={200} />
        </div>
      </Card>
      <Card title="Page facts">
        <div className="flex flex-col gap-6">
          {(d.internal_links ?? 0) + (d.external_links ?? 0) > 0 && (
            <SplitDonut
              parts={[
                { name: "Internal links", value: d.internal_links ?? 0, color: COLOR.ink },
                { name: "External links", value: d.external_links ?? 0, color: "rgba(255,255,255,0.25)" },
              ]}
              center={(d.internal_links ?? 0) + (d.external_links ?? 0)}
              caption="links"
            />
          )}
          <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-4">
            {[
              ["Words", d.word_count],
              ["HTML size", d.page_size_kb != null ? `${d.page_size_kb} KB` : undefined],
              ["Internal links", d.internal_links, COLOR.ink],
              ["External links", d.external_links, "rgba(255,255,255,0.25)"],
            ].map(([label, value, dot]) => (
              <div key={label as string}>
                <dt className="flex items-center gap-1.5 whitespace-nowrap font-sub text-[12px] text-ink-3">
                  {dot && <span className="size-1.5 shrink-0 rounded-full" style={{ background: dot as string }} />}
                  {label}
                </dt>
                <dd className="mt-0.5 whitespace-nowrap font-display text-[22px] font-semibold tracking-[-0.03em] tabular-nums">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Card>
    </div>
  );
}

export function AeoExtras({ module }: { module: ModuleResult }) {
  const questions = (module.data.questions as { question: string; answer_words: number }[] | undefined) ?? [];
  if (!questions.length) return null;
  return (
    <Card title="Questions on this page" note="Answers of 20–80 words directly under the question are most likely to be quoted.">
      <ul className="divide-y divide-line">
        {questions.map((q) => {
          const ok = q.answer_words >= 20 && q.answer_words <= 80;
          return (
            <li key={q.question} className="flex items-center justify-between gap-4 py-3 text-sm">
              <span className="min-w-0 flex-1">{q.question}</span>
              <span className={`shrink-0 rounded-sm px-2 py-0.5 font-mono text-xs ${ok ? "bg-good-soft text-good" : "bg-warn-soft text-warn"}`}>
                {q.answer_words} words
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function GeoExtras({ module }: { module: ModuleResult }) {
  const crawlers = (module.data.crawlers as Crawler[] | undefined) ?? [];
  const probes = module.data.probes as { category?: string; results?: Probe[]; error?: string } | null | undefined;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="AI crawler access" note="Read from your robots.txt.">
        {crawlers.length > 0 && (
          <div className="mb-4 flex items-center gap-5 border-b border-line pb-4">
            <SplitDonut
              parts={[
                { name: "Allowed", value: crawlers.filter((c) => c.allowed).length, color: COLOR.good },
                { name: "Blocked", value: crawlers.filter((c) => !c.allowed).length, color: COLOR.bad },
              ]}
              center={`${crawlers.filter((c) => c.allowed).length}/${crawlers.length}`}
              caption="allowed"
            />
            <p className="text-[14px] leading-relaxed text-ink-2">
              {crawlers.every((c) => c.allowed)
                ? "Every major AI crawler can read this site."
                : `${crawlers.filter((c) => !c.allowed).length} AI crawler${crawlers.filter((c) => !c.allowed).length === 1 ? " is" : "s are"} blocked, so those assistants can't quote this page.`}
            </p>
          </div>
        )}
        <ul className="divide-y divide-line">
          {crawlers.map((c) => (
            <li key={c.bot} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span>
                <span className="font-mono">{c.bot}</span>
                <span className="ml-2 text-ink-3">{c.owner}</span>
              </span>
              <span className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium ${c.allowed ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>
                {c.allowed ? <CheckIcon aria-hidden="true" className="size-3" /> : <X aria-hidden="true" className="size-3" />}
                {c.allowed ? "Allowed" : "Blocked"}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Live AI visibility" note={probes?.category ? `Buyer questions about “${probes.category}”.` : "Real questions asked to real models."}>
        {!probes ? (
          <div className="flex gap-3 rounded-lg bg-surface-2 p-4 text-sm text-ink-2">
            <KeyRound aria-hidden="true" className="size-5 shrink-0 text-ink-3" />
            <p>Add an OpenRouter API key to the backend to ask ChatGPT-class and Perplexity models about your category and see whether they mention you.</p>
          </div>
        ) : probes.error ? (
          <p className="text-sm text-bad">{probes.error}</p>
        ) : (
          <ul className="space-y-3">
            {probes.results?.map((p, i) => (
              <li key={i} className="rounded-lg border border-line p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{p.prompt}</p>
                  <span
                    className={`shrink-0 rounded-sm px-2 py-0.5 text-xs font-medium ${
                      p.error ? "bg-surface-2 text-ink-3" : p.mentioned ? "bg-good-soft text-good" : "bg-bad-soft text-bad"
                    }`}
                  >
                    {p.error ? "Failed" : p.mentioned ? (p.cited ? "Cited" : "Mentioned") : "Not mentioned"}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-ink-3">{p.model}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function PerformanceExtras({ module }: { module: ModuleResult }) {
  const lab = (module.data.lab as LabMetric[] | undefined) ?? [];
  const field = (module.data.field as Record<string, { value: number; category: string }> | undefined) ?? {};
  const tone = { pass: "text-good", warn: "text-warn", fail: "text-bad", info: "text-ink" } as const;
  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {lab.map((m) => (
          <li key={m.id} className="rounded-xl border border-line bg-surface p-4">
            <p className="font-sub text-xs text-ink-3">{m.label}</p>
            <p className={`mt-1 font-mono text-2xl ${tone[m.status]}`}>{m.display}</p>
            {/* gauge: green up to "good", amber up to "poor", red beyond; marker shows the value */}
            <div className="relative mt-3 flex h-1.5 overflow-hidden rounded-full" aria-hidden="true">
              <span className="bg-good/70" style={{ width: `${(m.good / (m.poor * 1.5)) * 100}%` }} />
              <span className="bg-warn/70" style={{ width: `${((m.poor - m.good) / (m.poor * 1.5)) * 100}%` }} />
              <span className="flex-1 bg-bad/70" />
              <span
                className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-ink"
                style={{ left: `${Math.min(100, (m.value / (m.poor * 1.5)) * 100)}%` }}
              />
            </div>
            <p className="mt-2 font-sub text-xs text-ink-3">
              Good ≤ {m.good}
              {m.unit}
            </p>
          </li>
        ))}
      </ul>
      {Object.keys(field).length > 0 && (
        <Card title="Real-user data (Chrome UX Report)" note="75th percentile of real visits over the last 28 days.">
          <dl className="flex flex-wrap gap-8">
            {Object.entries(field).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-ink-3">{k}</dt>
                <dd className="font-mono text-xl tabular-nums">
                  {k === "CLS" ? v.value.toFixed(2) : `${compact(v.value)} ms`}
                  <span className="ml-2 font-sans text-xs text-ink-3">{v.category.toLowerCase()}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </div>
  );
}

/** "4-10" → [4, 10]; "1" → [1, 1]; "101+" → [101, ∞] */
function bandRange(band: string): [number, number] {
  const [lo, hi] = band.replace("+", "-").split("-");
  const start = Number(lo);
  return [start, hi === undefined ? start : hi === "" ? Infinity : Number(hi)];
}

export function TrafficPanel({ module }: { module: ModuleResult | undefined }) {
  const [band, setBand] = useState<string | null>(null);
  if (!module || !module.available) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong p-8">
        <h4 className="font-display text-xl font-bold">Traffic estimates aren&apos;t connected yet</h4>
        <p className="mt-2 max-w-[60ch] text-ink-2">
          {module?.summary ??
            "No tool can see another site's real analytics. Estimates come from a keyword-ranking provider such as DataForSEO."}
        </p>
      </div>
    );
  }
  const d = module.data as {
    estimated_monthly_visits: number;
    ranking_keywords: number;
    traffic_value_usd: number;
    positions: Record<string, number>;
    top_keywords: KeywordRow[];
    source: string;
  };
  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          ["Est. monthly organic visits", compact(d.estimated_monthly_visits)],
          ["Ranking keywords", compact(d.ranking_keywords)],
          ["Equivalent ad value / mo", `$${compact(d.traffic_value_usd)}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-surface p-5">
            <dt className="text-sm text-ink-3">{label}</dt>
            <dd className="mt-1 font-mono text-3xl tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <Card title="Keywords by Google position" note="Positions 1–3 get most of the clicks.">
        <PositionsChart data={Object.entries(d.positions).map(([b, count]) => ({ band: b, count }))} selected={band} onSelect={setBand} />
      </Card>
      {d.top_keywords.length > 0 && (
        <Card title={band ? `Keywords at #${band}` : "Top keywords"} note={band ? "Filtered from the chart. Click the column again to clear." : d.source}>
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs text-ink-3">
                <tr>
                  <th className="px-2 py-2 font-medium">Keyword</th>
                  <th className="px-2 py-2 text-right font-medium">Position</th>
                  <th className="px-2 py-2 text-right font-medium">Volume</th>
                  <th className="px-2 py-2 text-right font-medium">Est. visits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {d.top_keywords
                  .filter((k) => {
                    if (!band) return true;
                    const [lo, hi] = bandRange(band);
                    return k.position != null && k.position >= lo && k.position <= hi;
                  })
                  .map((k, i) => (
                  <tr key={`${k.keyword}-${i}`} className="transition-colors duration-150 hover:bg-surface-2">
                    <td className="px-2 py-2">{k.keyword}</td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums">{k.position ?? "—"}</td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums">{k.volume != null ? compact(k.volume) : "—"}</td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums">{k.etv != null ? compact(Math.round(k.etv)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
