"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BellRing, GitCommitHorizontal } from "lucide-react";
import { byChapter, type Feature } from "@/lib/features";
import { StatusTag } from "./chapters";

/* illustrative sample data, one visual per step */

function Week() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div>
      <p className="font-sub text-[13px] text-ink-3">Audits this month</p>
      <div className="mt-4 grid grid-cols-7 gap-2">
        {Array.from({ length: 28 }, (_, i) => (
          <span key={i} className={`aspect-square rounded-md ${i % 7 === 0 ? "bg-good" : i > 24 ? "border border-dashed border-white/15" : "bg-white/[0.06]"}`} />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2 text-center font-sub text-[11px] text-ink-3">
        {days.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <p className="mt-5 font-sub text-[13.5px] text-ink-2">Every Monday, automatically. Next audit in 3 days.</p>
    </div>
  );
}

function Deploy() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
        <GitCommitHorizontal aria-hidden="true" className="size-4 text-ink-3" />
        <span className="font-mono text-[13px] text-ink-2">Deploy #482 · main</span>
        <span className="ml-auto font-sub text-[12px] text-ink-3">2 min ago</span>
      </div>
      <ul className="space-y-2 font-sub text-[14px]">
        <li className="rounded-lg bg-bad-soft px-4 py-2.5 text-ink-2">
          <span className="font-semibold text-bad">+ New</span> · Title tag missing on /pricing
        </li>
        <li className="rounded-lg bg-good-soft px-4 py-2.5 text-ink-2">
          <span className="font-semibold text-good">− Resolved</span> · 2 broken links on /blog
        </li>
      </ul>
    </div>
  );
}

function Regression() {
  return (
    <div className="relative">
      <svg viewBox="0 0 300 120" className="w-full" aria-hidden="true">
        <line x1="0" y1="78" x2="300" y2="78" stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
        <text x="300" y="72" textAnchor="end" fontSize="9" fill="#a1a1aa">good ≤ 2.5 s</text>
        <polyline points="0,96 50,92 100,95 150,90 200,88 240,60 300,34" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="300" cy="34" r="4" fill="#ef4444" />
      </svg>
      <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/[0.1] bg-[#1c1d1f] px-4 py-3 shadow-[0_16px_40px_rgb(0_0_0/0.5)]">
        <BellRing aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-bad" />
        <p className="text-[14px] text-ink-2">
          Largest Contentful Paint got slower: <span className="text-ink">1.9 s → 3.4 s</span>
        </p>
      </div>
    </div>
  );
}

function History() {
  return (
    <div>
      <svg viewBox="0 0 300 120" className="w-full" aria-hidden="true">
        <defs>
          <linearGradient id="hist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fafafa" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#fafafa" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0,90 C40,88 60,80 90,76 S150,70 180,52 S250,36 300,24 L300,120 L0,120 Z" fill="url(#hist)" />
        <path d="M0,90 C40,88 60,80 90,76 S150,70 180,52 S250,36 300,24" fill="none" stroke="#fafafa" strokeWidth="2" />
      </svg>
      <p className="mt-4 font-sub text-[14px] text-ink-2">
        Health score <span className="text-ink">61 → 78</span> in eight weeks · 14 issues resolved
      </p>
    </div>
  );
}

function Verify() {
  return (
    <div className="flex items-end justify-center gap-10">
      {[
        ["Before", 46, "#f59e0b", "Clicks / day 120"],
        ["After", 82, "#3ccf91", "Clicks / day 171"],
      ].map(([label, h, color, note]) => (
        <div key={label as string} className="flex w-28 flex-col items-center">
          <span className="font-display text-[34px] font-semibold tracking-[-0.03em]" style={{ color: color as string }}>
            {h}
          </span>
          <span className="mt-2 w-full rounded-t-lg" style={{ height: `${(h as number) * 1.6}px`, background: color as string, opacity: 0.85 }} />
          <span className="mt-3 font-sub text-[13px] text-ink-2">{label}</span>
          <span className="font-sub text-[11.5px] text-ink-3">{note}</span>
        </div>
      ))}
    </div>
  );
}

const VISUALS: Record<string, ReactNode> = {
  monitoring: <Week />,
  "change-detective": <Deploy />,
  "regression-alerts": <Regression />,
  "health-history": <History />,
  verification: <Verify />,
};

/** Sticky visual on the left, steps scroll on the right; the visual follows the step in view. */
export function MonitorScene() {
  // read here, not passed as a prop: features carry icon components, which can't cross the server→client boundary
  const features: Feature[] = byChapter("monitor");
  const [active, setActive] = useState(0);
  const steps = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    steps.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="grid gap-16 lg:grid-cols-2">
      <div className="hidden lg:block">
        <div className="panel sticky top-[20vh] h-[52vh] min-h-[400px] overflow-hidden rounded-[28px]">
          {features.map((f, i) => (
            <div
              key={f.slug}
              aria-hidden={i !== active}
              className="absolute inset-0 flex items-center p-12 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ opacity: i === active ? 1 : 0, transform: `translateY(${i === active ? 0 : i < active ? -16 : 16}px)` }}
            >
              <div className="w-full">{VISUALS[f.slug]}</div>
            </div>
          ))}
        </div>
      </div>

      <ol>
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <li
              key={f.slug}
              ref={(el) => {
                steps.current[i] = el;
              }}
              data-index={i}
              className="flex flex-col justify-center border-l border-white/[0.06] py-10 pl-8 transition-[opacity,border-color] duration-500 lg:min-h-[40vh]"
              style={{ opacity: i === active ? 1 : 0.45, borderColor: i === active ? "var(--cobalt)" : undefined }}
            >
              <div className="flex items-center gap-3">
                <Icon aria-hidden="true" className="size-5 text-cobalt" />
                <StatusTag status={f.status} />
              </div>
              <h3 className="mt-4 text-[clamp(2rem,3.6vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.025em]">{f.name}</h3>
              <p className="mt-3 max-w-[38ch] text-[19px] leading-relaxed text-ink-3">{f.pitch}</p>
              <div className="panel mt-8 rounded-2xl p-6 lg:hidden">{VISUALS[f.slug]}</div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
