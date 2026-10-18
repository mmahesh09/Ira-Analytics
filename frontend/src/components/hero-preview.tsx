import { CircleCheck, CircleDot, CircleX, Gauge, LayoutGrid, MessageSquareQuote, Bot, Search, TrendingUp, TriangleAlert } from "lucide-react";
import { ScoreRing } from "./score-ring";

const NAV = [
  { icon: LayoutGrid, label: "Fix first", n: "12", active: true },
  { icon: Search, label: "SEO", n: "88" },
  { icon: MessageSquareQuote, label: "AEO", n: "54" },
  { icon: Bot, label: "GEO", n: "41" },
  { icon: Gauge, label: "Speed", n: "76" },
  { icon: TrendingUp, label: "Traffic", n: "8.4k" },
];

const ISSUES = [
  { id: "GEO-3", icon: CircleX, tone: "text-bad", title: "PerplexityBot and GPTBot blocked in robots.txt", tag: "Crawlers", p: 3 },
  { id: "AEO-1", icon: CircleX, tone: "text-bad", title: "No FAQ or HowTo schema on question content", tag: "Schema", p: 3 },
  { id: "GEO-7", icon: TriangleAlert, tone: "text-warn", title: "Brand entity missing sameAs links", tag: "Entity", p: 2 },
  { id: "SEO-4", icon: TriangleAlert, tone: "text-warn", title: "Meta description is 182 characters", tag: "On-page", p: 2 },
  { id: "SPD-2", icon: TriangleAlert, tone: "text-warn", title: "Total Blocking Time 340 ms on mobile", tag: "Vitals", p: 2 },
  { id: "AEO-5", icon: CircleDot, tone: "text-ink-3", title: "3 answers longer than snippet length", tag: "Content", p: 1 },
  { id: "SEO-1", icon: CircleCheck, tone: "text-good", title: "Canonical and hreflang are valid", tag: "On-page", p: 0 },
];

const BARS = [
  { label: "SEO", v: 88, c: "bg-good" },
  { label: "AEO", v: 54, c: "bg-warn" },
  { label: "GEO", v: 41, c: "bg-bad" },
  { label: "Speed", v: 76, c: "bg-warn" },
];

function Priority({ level }: { level: number }) {
  return (
    <span className="flex items-end gap-[2px]" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <span key={i} className={`w-[3px] rounded-[1px] ${i <= level ? "bg-ink-2" : "bg-white/15"}`} style={{ height: 4 + i * 3 }} />
      ))}
    </span>
  );
}

/**
 * Large product "screenshot" of the report UI, tilted in perspective and fading into the page.
 * Server component: entrance is CSS keyframes (globals.css `.hero-tilt` etc.) so the LCP element never waits on JS.
 */
export function HeroPreview() {
  return (
    <div aria-hidden="true" className="relative [perspective:2400px]">
      <div className="hero-tilt [mask-image:linear-gradient(to_bottom,black_55%,transparent_100%)]">
        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-surface shadow-[0_0_0_1px_rgb(0_0_0/0.4),0_40px_120px_rgb(0_0_0/0.6)]">
          <div className="grid min-h-[440px] grid-cols-[200px_minmax(0,1fr)_240px] max-lg:grid-cols-[180px_minmax(0,1fr)] max-md:grid-cols-1">
            {/* sidebar */}
            <aside className="border-r border-white/[0.06] bg-surface-ink/60 p-3 max-md:hidden">
              <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
                <span className="grid size-5 place-items-center rounded bg-ink font-sub text-[10px] font-semibold text-paper">N</span>
                <span className="truncate font-sub text-[13px] font-medium">northwind-coffee.com</span>
              </div>
              <ul className="mt-4 space-y-0.5 font-sub text-[13px]">
                {NAV.map((n) => (
                  <li key={n.label} className={`flex items-center justify-between rounded-md px-2 py-1.5 ${n.active ? "bg-white/[0.06] text-ink" : "text-ink-3"}`}>
                    <span className="flex items-center gap-2">
                      <n.icon className="size-3.5" /> {n.label}
                    </span>
                    <span className="font-mono text-[11px] text-ink-3">{n.n}</span>
                  </li>
                ))}
              </ul>
            </aside>

            {/* issue list */}
            <main className="min-w-0">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <p className="font-sub text-[13px] font-medium">Fix these first</p>
                <div className="flex gap-1.5 font-sub text-[11px]">
                  <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-ink-2">All 33</span>
                  <span className="rounded-md px-2 py-0.5 text-ink-3">Critical 4</span>
                  <span className="rounded-md px-2 py-0.5 text-ink-3">Improve 12</span>
                </div>
              </div>
              <ul>
                {ISSUES.map((i, k) => (
                  <li
                    key={i.id}
                    style={{ animationDelay: `${0.6 + k * 0.06}s` }}
                    className="hero-fade flex items-center gap-3 border-b border-white/[0.04] px-4 py-2.5 font-sub text-[13px]"
                  >
                    <Priority level={i.p} />
                    <span className="w-12 shrink-0 font-mono text-[11px] text-ink-3">{i.id}</span>
                    <i.icon className={`size-3.5 shrink-0 ${i.tone}`} />
                    <span className="min-w-0 flex-1 truncate text-ink-2">{i.title}</span>
                    <span className="hidden shrink-0 rounded-full border border-white/[0.08] px-2 py-0.5 text-[11px] text-ink-3 sm:inline">{i.tag}</span>
                  </li>
                ))}
              </ul>
            </main>

            {/* score panel */}
            <aside className="border-l border-white/[0.06] p-5 max-lg:hidden">
              <p className="font-sub text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Overall</p>
              <div className="mt-3">
                <ScoreRing score={67} size={104} stroke={7} label="Sample overall score" />
              </div>
              <ul className="mt-6 space-y-3">
                {BARS.map((b, k) => (
                  <li key={b.label}>
                    <div className="flex justify-between font-sub text-[12px]">
                      <span className="text-ink-3">{b.label}</span>
                      <span className="font-mono text-ink-2">{b.v}</span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className={`hero-grow h-1 origin-left rounded-full ${b.c}`} style={{ width: `${b.v}%`, animationDelay: `${0.7 + k * 0.08}s` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
