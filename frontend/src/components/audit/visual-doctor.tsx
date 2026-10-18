"use client";

import { useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { ModuleResult } from "@/lib/types";

type Box = { n: number; x: number; y: number; w: number; h: number };
type Violation = { n: number; id: string; impact: "critical" | "serious" | "moderate" | "minor"; help: string; helpUrl: string; count: number; html: string[] };

const IMPACT: Record<Violation["impact"], { color: string; label: string }> = {
  critical: { color: "#ef4444", label: "Critical" },
  serious: { color: "#ff8f5c", label: "Serious" },
  moderate: { color: "#f59e0b", label: "Moderate" },
  minor: { color: "#a1a1aa", label: "Minor" },
};

/** Visual Website Doctor: the page screenshot with numbered boxes, linked to the list of accessibility problems. */
export function VisualDoctor({ module }: { module: ModuleResult }) {
  const d = module.data as { screenshot?: string; width?: number; height?: number; boxes?: Box[]; violations?: Violation[]; passes?: number };
  const [active, setActive] = useState<number | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  if (!d.screenshot || !d.width || !d.height) return null;
  const violations = d.violations ?? [];
  const boxes = d.boxes ?? [];
  const impactOf = (n: number) => violations.find((v) => v.n === n)?.impact ?? "minor";

  /** Scroll the screenshot so the first box for this problem is in view. */
  function focus(n: number) {
    setActive(n);
    const box = boxes.find((b) => b.n === n);
    const el = frame.current;
    if (box && el) el.scrollTo({ top: Math.max(0, (box.y / d.height!) * el.scrollHeight - el.clientHeight / 3), behavior: "smooth" });
  }

  return (
    <section aria-labelledby="doctor-title" className="panel overflow-hidden rounded-xl">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-6 py-4">
        <h2 id="doctor-title" className="text-[17px] font-medium tracking-[-0.01em]">
          Visual Website Doctor
        </h2>
        <p className="font-sub text-[12.5px] text-ink-3">
          {violations.length} problem{violations.length === 1 ? "" : "s"} marked · {d.passes ?? 0} rules passed · hover a problem to find it
        </p>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div ref={frame} className="relative max-h-[620px] overflow-y-auto border-line bg-[#0b0c0d] lg:border-r">
          <div className="relative" style={{ aspectRatio: `${d.width} / ${d.height}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- runtime screenshot from our API, dimensions known */}
            <img src={d.screenshot} alt="Screenshot of the audited page with accessibility problems marked" width={d.width} height={d.height} className="absolute inset-0 size-full" loading="lazy" decoding="async" />
            {boxes.map((b, i) => {
              const color = IMPACT[impactOf(b.n)].color;
              const on = active === null || active === b.n;
              return (
                <span
                  key={i}
                  aria-hidden="true"
                  className="absolute rounded-[3px] border-2 transition-opacity duration-200"
                  style={{ left: `${(b.x / d.width!) * 100}%`, top: `${(b.y / d.height!) * 100}%`, width: `${(b.w / d.width!) * 100}%`, height: `${(b.h / d.height!) * 100}%`, borderColor: color, opacity: on ? 1 : 0.15, boxShadow: active === b.n ? `0 0 0 4px ${color}55` : undefined }}
                >
                  <span className="absolute -left-2 -top-2 grid size-[18px] place-items-center rounded-full font-sub text-[10.5px] font-semibold text-[#08090a]" style={{ background: color }}>
                    {b.n}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
        <ol className="max-h-[620px] divide-y divide-line overflow-y-auto" onMouseLeave={() => setActive(null)}>
          {violations.length === 0 && <li className="p-6 text-[14.5px] text-ink-2">No WCAG A/AA violations found on this page.</li>}
          {violations.map((v) => (
            <li key={v.n}>
              <button
                type="button"
                onMouseEnter={() => focus(v.n)}
                onFocus={() => focus(v.n)}
                onClick={() => focus(v.n)}
                aria-pressed={active === v.n}
                className={`flex w-full cursor-pointer gap-3 px-5 py-3.5 text-left transition-colors ${active === v.n ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"}`}
              >
                <span className="mt-0.5 grid size-[20px] shrink-0 place-items-center rounded-full font-sub text-[11px] font-semibold text-[#08090a]" style={{ background: IMPACT[v.impact].color }}>
                  {v.n}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] leading-snug text-ink">{v.help}</span>
                  <span className="mt-0.5 block font-sub text-[12px] text-ink-3">
                    <span style={{ color: IMPACT[v.impact].color }}>{IMPACT[v.impact].label}</span> · {v.count} element{v.count === 1 ? "" : "s"} · {v.id}
                  </span>
                </span>
              </button>
              <a href={v.helpUrl} target="_blank" rel="noreferrer" className="-mt-1 mb-3 ml-[52px] inline-flex items-center gap-1 font-sub text-[12px] text-ink-3 hover:text-ink">
                How to fix <ExternalLink aria-hidden="true" className="size-3" />
              </a>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
