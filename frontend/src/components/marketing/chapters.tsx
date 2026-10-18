import type { ReactNode } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { CHAPTERS, type Chapter, type Feature } from "@/lib/features";

/* ---------- chapter heading ---------- */

/** Splits a title into a white lead and a purple tail: after the first sentence, else the first comma, else the last two words. */
export function splitTitle(title: string): [string, string] {
  const stop = title.indexOf(". ");
  if (stop > 0) return [title.slice(0, stop + 1), title.slice(stop + 2)];
  const comma = title.indexOf(", ");
  if (comma > 0) return [title.slice(0, comma + 1), title.slice(comma + 2)];
  const words = title.split(" ");
  return [words.slice(0, -2).join(" "), words.slice(-2).join(" ")];
}

export function ChapterHead({ chapter, count }: { chapter: Chapter; count: number }) {
  const c = CHAPTERS[chapter];
  // the chapters are a real sequence (detect → fix → monitor → understand → report), so the number is true
  const n = String(Object.keys(CHAPTERS).indexOf(chapter) + 1).padStart(2, "0");
  const [lead, tail] = splitTitle(c.title);
  return (
    <Reveal className="max-w-[880px]">
      <p className="eyebrow flex items-center gap-3">
        <span className="text-cobalt">{n}</span>
        <span aria-hidden="true" className="h-px w-8 bg-white/15" />
        {c.label}
        <span className="text-ink-3/60">· {count} features</span>
      </p>
      <h2 className="mt-6 text-[clamp(2.75rem,6.5vw,5rem)] font-semibold leading-[1.02] tracking-[-0.03em]">
        <span className="text-gradient pb-1">{lead}</span> <span className="text-accent pb-1">{tail}</span>
      </h2>
      <p className="mt-6 max-w-[48ch] text-[clamp(1.125rem,1.6vw,1.3125rem)] leading-relaxed text-ink-3">{c.body}</p>
    </Reveal>
  );
}

/* ---------- feature tiles (bento) ---------- */

export function StatusTag({ status }: { status: Feature["status"] }) {
  return status === "live" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-good/25 bg-good-soft px-2 py-0.5 font-code text-[10.5px] uppercase tracking-[0.1em] text-good">
      <span className="size-1.5 rounded-full bg-good" /> Live
    </span>
  ) : (
    <span className="rounded-full border border-line-strong px-2 py-0.5 font-code text-[10.5px] uppercase tracking-[0.1em] text-ink-3">Coming soon</span>
  );
}

function Tile({ feature, visual, big = false }: { feature: Feature; visual?: ReactNode; big?: boolean }) {
  const Icon = feature.icon;
  return (
    <article
      className={`panel group flex h-full flex-col overflow-hidden rounded-[20px] transition-[border-color] duration-200 hover:border-white/[0.16] ${big ? "p-8 sm:p-10" : "p-7"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-10 place-items-center rounded-xl border border-cobalt/20 bg-cobalt-soft">
          <Icon aria-hidden="true" className="size-5 text-cobalt" />
        </span>
        <StatusTag status={feature.status} />
      </div>
      <h3 className={`mt-6 font-semibold tracking-[-0.025em] ${big ? "text-[28px] sm:text-[32px]" : "text-[21px]"}`}>{feature.name}</h3>
      <p className={`mt-2 leading-relaxed text-ink-3 ${big ? "max-w-[40ch] text-[17px]" : "text-[15.5px]"}`}>{feature.pitch}</p>
      {visual && <div className="mt-auto pt-8">{visual}</div>}
    </article>
  );
}

/** First feature large with its visual, the rest as a varied grid. Never three equal cards. */
export function FeatureBento({ features, visuals }: { features: Feature[]; visuals: Record<string, ReactNode> }) {
  const [lead, ...rest] = features;
  return (
    <div className="grid gap-4 lg:grid-cols-6">
      <Reveal className="lg:col-span-4">
        <Tile feature={lead} visual={visuals[lead.slug]} big />
      </Reveal>
      {rest.map((f, i) => (
        <Reveal key={f.slug} delay={0.05 * (i + 1)} className={i === 0 ? "lg:col-span-2" : rest.length === 3 ? "lg:col-span-3" : "lg:col-span-2"}>
          <Tile feature={f} visual={visuals[f.slug]} />
        </Reveal>
      ))}
    </div>
  );
}

/* ---------- small, purpose-built visuals (illustrative sample data) ---------- */

export function ScoreVisual() {
  return (
    <div aria-hidden="true">
      <div className="flex items-end gap-3">
        <span className="font-display text-[84px] font-semibold leading-[0.85] tracking-[-0.045em] text-warn tabular-nums">72</span>
        <span className="mb-2 font-sub text-[14px] text-ink-3">
          out of 100
          <br />
          <span className="text-warn">Needs work</span>
        </span>
      </div>
      <div className="relative mt-6 h-2">
        <div className="flex h-2 overflow-hidden rounded-full">
          <span className="w-1/2 bg-bad/30" />
          <span className="w-[30%] bg-warn/30" />
          <span className="flex-1 bg-good/30" />
        </div>
        <span className="absolute inset-y-0 left-0 w-[72%] rounded-full bg-warn" />
      </div>
      <dl className="mt-6 grid grid-cols-4 gap-3 font-sub text-[12.5px]">
        {[
          ["SEO", 86, "text-good"],
          ["AEO", 58, "text-warn"],
          ["GEO", 64, "text-warn"],
          ["Speed", 79, "text-warn"],
        ].map(([k, v, c]) => (
          <div key={k as string} className="rounded-lg bg-surface-2/60 p-3">
            <dt className="text-ink-3">{k}</dt>
            <dd className={`mt-0.5 font-display text-[22px] font-semibold tracking-[-0.03em] tabular-nums ${c}`}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function LinksVisual() {
  return (
    <ul aria-hidden="true" className="space-y-2 font-sub text-[13px]">
      {[
        ["404", "/blog/old-pricing"],
        ["500", "partner-site.com/api"],
        ["200", "/features"],
      ].map(([code, url]) => (
        <li key={url} className="flex items-center gap-3 rounded-lg bg-surface-2/60 px-3 py-2">
          <span className={`rounded px-1.5 py-0.5 font-mono text-[11.5px] ${code === "200" ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>{code}</span>
          <span className="truncate text-ink-2">{url}</span>
        </li>
      ))}
    </ul>
  );
}

export function A11yVisual() {
  return (
    <div aria-hidden="true" className="flex items-center gap-4">
      <span className="grid size-16 place-items-center rounded-xl bg-[#c9c9cf] font-display text-[26px] font-semibold text-[#a9a9ae]">Aa</span>
      <ArrowRight className="size-4 text-ink-3" />
      <span className="grid size-16 place-items-center rounded-xl bg-[#c9c9cf] font-display text-[26px] font-semibold text-[#1d1d1f]">Aa</span>
      <span className="font-sub text-[13px] text-ink-3">
        Contrast
        <br />
        <span className="text-bad">1.4:1</span> → <span className="text-good">10:1</span>
      </span>
    </div>
  );
}

export function DoctorVisual() {
  return (
    <div aria-hidden="true" className="relative h-[120px] overflow-hidden rounded-lg border border-line bg-surface-2/60">
      <div className="absolute left-4 top-4 h-3 w-24 rounded bg-ink/15" />
      <div className="absolute left-4 top-10 h-2 w-40 rounded bg-ink/10" />
      <div className="absolute left-4 top-[60px] h-12 w-20 rounded bg-ink/10" />
      <div className="absolute left-28 top-[60px] h-12 w-28 rounded bg-ink/10" />
      {[
        ["left-3 top-3 h-5 w-[104px]", "1"],
        ["left-[108px] top-[56px] h-[56px] w-[120px]", "2"],
      ].map(([pos, n]) => (
        <span key={n} className={`absolute rounded-md border-2 border-bad ${pos}`}>
          <span className="absolute -right-2.5 -top-2.5 grid size-5 place-items-center rounded-full bg-bad font-sub text-[11px] font-semibold text-white">{n}</span>
        </span>
      ))}
    </div>
  );
}

export function OpportunityVisual() {
  return (
    <ol aria-hidden="true" className="space-y-2 font-sub text-[13.5px]">
      {[
        ["Add FAQ schema", "+7"],
        ["Use question headings", "+7"],
        ["Define your brand entity", "+5"],
        ["Lengthen the title", "+2"],
      ].map(([t, p], i) => (
        <li key={t} className="flex items-center gap-3 rounded-lg bg-surface-2/70 px-3 py-2.5">
          <span className="w-4 font-display text-[13px] font-semibold text-ink-3">{i + 1}</span>
          <span className="flex-1 text-ink-2">{t}</span>
          <span className="font-semibold text-good tabular-nums">{p}</span>
        </li>
      ))}
      <li className="pt-2 text-right text-[13px] text-ink-3">
        65 → <span className="font-semibold text-good">87</span> after four fixes
      </li>
    </ol>
  );
}

export function FixVisual() {
  return (
    <pre aria-hidden="true" className="overflow-hidden rounded-xl bg-[#1d1d1f] p-4 font-mono text-[12px] leading-[1.7] text-[#d4d4d8]">
      <span className="text-[#8ab4f8]">{"<meta"}</span> name=<span className="text-[#86efac]">&quot;description&quot;</span>
      {"\n  "}content=<span className="text-[#86efac]">&quot;Hand-roasted coffee, delivered…&quot;</span> <span className="text-[#8ab4f8]">{"/>"}</span>
    </pre>
  );
}

export function ContentVisual() {
  return (
    <div aria-hidden="true" className="space-y-2.5 font-sub text-[13.5px]">
      <p className="rounded-lg bg-surface-2/70 px-3 py-2 text-ink-3 line-through decoration-bad/60">Welcome to our website</p>
      <p className="flex items-start gap-2 rounded-lg bg-surface-2/70 px-3 py-2 text-ink">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-ink-3" /> Fresh-roasted coffee, delivered weekly | Northwind
      </p>
    </div>
  );
}

export function ChatVisual() {
  return (
    <div aria-hidden="true" className="space-y-3">
      <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-[#9333ea] px-4 py-2.5 text-[14.5px] text-white">Why did traffic drop last week?</div>
      <div className="w-fit max-w-[88%] rounded-2xl rounded-bl-md bg-surface-2 px-4 py-3 text-[14.5px] leading-relaxed text-ink-2">
        Clicks from Google fell 18% after Tuesday&apos;s deploy. Two pages lost their title tags. Restoring them is the top fix.
        <span className="mt-2 block font-sub text-[12px] text-ink-3">Sources: Search Console · Audit, 14 Oct</span>
      </div>
    </div>
  );
}

/* ---------- report spread (dark chapter) ---------- */

export function ReportSpread() {
  return (
    <div aria-hidden="true" className="relative mx-auto h-[420px] w-full max-w-[640px]">
      <div className="absolute right-0 top-10 h-[360px] w-[256px] rotate-[6deg] rounded-md bg-[#f5f5f7] p-6 shadow-[0_30px_80px_rgb(0_0_0/0.5)]">
        <p className="font-sub text-[10px] uppercase tracking-[0.12em] text-[#6e6e73]">Fix plan</p>
        <ul className="mt-4 space-y-2">
          {[78, 64, 52, 40, 30].map((w) => (
            <li key={w} className="flex items-center gap-2">
              <span className="size-3 rounded-sm border border-[#1d1d1f]/30" />
              <span className="h-1.5 rounded bg-[#1d1d1f]/15" style={{ width: `${w}%` }} />
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute left-1/2 top-4 h-[360px] w-[256px] -translate-x-1/2 rotate-[-1deg] rounded-md bg-white p-6 shadow-[0_30px_80px_rgb(0_0_0/0.5)]">
        <p className="font-sub text-[10px] uppercase tracking-[0.12em] text-[#6e6e73]">Scores</p>
        <div className="mt-6 flex h-[150px] items-end gap-3">
          {[86, 58, 64, 79].map((h, i) => (
            <span key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: h >= 80 ? "#1a7f4b" : "#a25a00", opacity: 0.85 }} />
          ))}
        </div>
        <div className="mt-6 space-y-1.5">
          <span className="block h-1.5 w-full rounded bg-[#1d1d1f]/10" />
          <span className="block h-1.5 w-4/5 rounded bg-[#1d1d1f]/10" />
        </div>
      </div>
      <div className="absolute left-0 top-0 h-[380px] w-[272px] rotate-[-7deg] rounded-md bg-white p-7 shadow-[0_40px_100px_rgb(0_0_0/0.6)]">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-[#9333ea] font-sub text-[11px] font-semibold text-white">A</span>
          <span className="font-sub text-[12px] font-medium text-[#1d1d1f]">Acme Agency</span>
        </div>
        <p className="mt-10 font-sub text-[11px] text-[#6e6e73]">Visibility report · northwind.com</p>
        <p className="mt-2 font-display text-[64px] font-semibold leading-none tracking-[-0.035em] text-[#a25a00]">72</p>
        <p className="mt-1 text-[13px] text-[#424245]">Strong on SEO, softer on AEO. Four fixes could lift you to 86.</p>
        <p className="absolute bottom-6 left-7 font-sub text-[10px] text-[#6e6e73]">Prepared for Northwind Coffee · Oct 2026</p>
      </div>
    </div>
  );
}
