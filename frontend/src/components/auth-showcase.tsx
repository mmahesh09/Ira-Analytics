import { Bot, Check, Gauge, MessageSquareQuote, Search } from "lucide-react";

const MODULES = [
  { icon: Search, label: "SEO", v: 88, c: "bg-good" },
  { icon: MessageSquareQuote, label: "AEO", v: 54, c: "bg-warn" },
  { icon: Bot, label: "GEO", v: 41, c: "bg-bad" },
  { icon: Gauge, label: "Speed", v: 76, c: "bg-warn" },
];

const POINTS = ["Visitors, sources and pages from a 1 KB cookieless script", "Weekly SEO, AEO and GEO audits with score history", "Which AI assistants mention you, tracked over time"];

/** Right-hand panel on the sign-in / sign-up pages: what the workspace gives you. Sample data, labelled as such. */
export function AuthShowcase() {
  return (
    <div className="relative flex h-full flex-col justify-center overflow-hidden border-l border-line bg-surface-ink px-12 py-16 xl:px-20">
      <div aria-hidden="true" className="grid-bg absolute inset-0 opacity-70" />
      <div aria-hidden="true" className="top-light absolute inset-0" />

      <div className="relative mx-auto w-full max-w-[440px]">
        <p className="font-sub text-[13px] text-ink-3">Your workspace</p>
        <h2 className="text-gradient mt-3 pb-1 text-[34px] font-semibold leading-[1.1] tracking-[-0.035em]">Every site, every engine, one score.</h2>

        <figure aria-label="Sample report" className="panel mt-10 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2.5">
              <span aria-hidden="true" className="grid size-7 place-items-center rounded-md bg-white/[0.08] font-sub text-[12px] font-medium">N</span>
              <span className="font-sub text-[14px]">northwind-coffee.com</span>
            </span>
            <span className="rounded-full border border-white/[0.08] px-2 py-0.5 font-sub text-[11px] text-ink-3">Sample</span>
          </div>

          <div className="mt-6 flex items-end gap-3">
            <span className="font-display text-[52px] font-semibold leading-none tracking-[-0.04em]">67</span>
            <span className="mb-1.5 font-sub text-[13px] text-ink-3">overall · <span className="text-good">+9 this month</span></span>
          </div>

          <ul className="mt-6 space-y-3">
            {MODULES.map((m) => (
              <li key={m.label} className="grid grid-cols-[72px_1fr_28px] items-center gap-3 font-sub text-[12.5px]">
                <span className="flex items-center gap-1.5 text-ink-3">
                  <m.icon aria-hidden="true" className="size-3.5" /> {m.label}
                </span>
                <span className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <span className={`hero-grow block h-1 origin-left rounded-full ${m.c}`} style={{ width: `${m.v}%` }} />
                </span>
                <span className="text-right font-mono text-ink-2">{m.v}</span>
              </li>
            ))}
          </ul>
        </figure>

        <ul className="mt-10 space-y-3.5">
          {POINTS.map((p) => (
            <li key={p} className="flex gap-3 text-[15px] leading-snug text-ink-2">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-3" /> {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
