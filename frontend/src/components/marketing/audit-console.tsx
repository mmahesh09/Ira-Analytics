import { ScoreRing } from "@/components/score-ring";

/* illustrative sample run; mirrors the real checks the audit performs */
const LINES: { mark: string; tone: string; text: string; meta: string }[] = [
  { mark: "→", tone: "text-ink-3", text: "GET northwind-coffee.com", meta: "200 · 312ms" },
  { mark: "✓", tone: "text-good", text: "robots.txt allows Googlebot, GPTBot", meta: "seo" },
  { mark: "✗", tone: "text-bad", text: "PerplexityBot blocked in robots.txt", meta: "geo" },
  { mark: "✓", tone: "text-good", text: "JSON-LD Organization found", meta: "geo" },
  { mark: "!", tone: "text-warn", text: "No FAQ schema on question pages", meta: "aeo" },
  { mark: "!", tone: "text-warn", text: "Meta description is 182 characters", meta: "seo" },
  { mark: "✓", tone: "text-good", text: "LCP 1.9 s · CLS 0.02", meta: "speed" },
  { mark: "✗", tone: "text-bad", text: "3 images without alt text", meta: "a11y" },
];

const MODULES = [
  { label: "SEO", v: 88, c: "bg-good" },
  { label: "AEO", v: 54, c: "bg-warn" },
  { label: "GEO", v: 41, c: "bg-bad" },
  { label: "Speed", v: 76, c: "bg-warn" },
];

/**
 * Hero signature: a live-looking audit run that streams checks, then lands on a score.
 * Server component; every entrance is a CSS keyframe so nothing waits on JS.
 */
export function AuditConsole() {
  const done = 0.5 + LINES.length * 0.18;
  return (
    <div aria-hidden="true" className="relative">
      <div className="console-glow absolute -inset-16 -z-10" />
      <div className="hero-fade overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0c0c0f]/90 shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_40px_100px_rgb(0_0_0/0.6)] backdrop-blur">
        {/* title bar */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-white/[0.12]" />
            <span className="size-2.5 rounded-full bg-white/[0.12]" />
            <span className="size-2.5 rounded-full bg-white/[0.12]" />
          </span>
          <span className="min-w-0 truncate font-code text-[11.5px] text-ink-3">rankwise audit · northwind-coffee.com</span>
          {/* sample, not a real customer (item 50) */}
          <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-2 py-0.5 font-sub text-[11px] text-ink-2">
            <span className="size-1.5 rounded-full bg-warn" /> Sample audit
          </span>
        </div>

        {/* streamed checks */}
        <ol className="space-y-[7px] px-4 py-4 font-code text-[12.5px] leading-5">
          {LINES.map((l, i) => (
            <li key={i} className="hero-fade flex items-center gap-3" style={{ animationDelay: `${0.5 + i * 0.18}s` }}>
              <span className={`w-3 shrink-0 text-center ${l.tone}`}>{l.mark}</span>
              <span className="min-w-0 flex-1 truncate text-ink-2">{l.text}</span>
              <span className="shrink-0 text-[11px] uppercase tracking-[0.08em] text-ink-3">{l.meta}</span>
            </li>
          ))}
          <li className="hero-fade flex items-center gap-3 text-ink-3" style={{ animationDelay: `${done}s` }}>
            <span className="w-3 text-center text-cobalt">❯</span>
            <span>
              33 findings · 12 fixes ranked by impact<span className="caret ml-1 inline-block h-3.5 w-[7px] translate-y-[2px] bg-cobalt" />
            </span>
          </li>
        </ol>

        {/* result */}
        <div className="hero-fade grid grid-cols-[auto_minmax(0,1fr)] items-center gap-6 border-t border-white/[0.06] bg-white/[0.015] px-5 py-5" style={{ animationDelay: `${done + 0.1}s` }}>
          <ScoreRing score={67} size={96} stroke={7} label="Sample overall score" />
          <ul className="space-y-2.5">
            {MODULES.map((m, k) => (
              <li key={m.label} className="grid grid-cols-[44px_minmax(0,1fr)_24px] items-center gap-3 font-sub text-[12px]">
                <span className="text-ink-3">{m.label}</span>
                <span className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <span className={`hero-grow block h-1 origin-left rounded-full ${m.c}`} style={{ width: `${m.v}%`, animationDelay: `${done + 0.2 + k * 0.08}s` }} />
                </span>
                <span className="text-right font-mono text-ink-2">{m.v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
