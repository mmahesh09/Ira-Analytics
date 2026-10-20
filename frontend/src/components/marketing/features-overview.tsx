import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { StatusTag } from "@/components/marketing/chapters";
import { CHAPTERS, FEATURES, liveCount } from "@/lib/features";

/**
 * Every tool in one grid (Tailark "features-13" layout, rebuilt on Rankwise tokens): a centred heading, then hairline
 * cells with icon, name, one-line pitch and a Live / Coming soon tag. Live tools first.
 */
export function FeaturesOverview() {
  const ordered = [...FEATURES].sort((a, b) => (a.status === b.status ? 0 : a.status === "live" ? -1 : 1));
  return (
    <div>
      <Reveal className="mx-auto max-w-[720px] text-center">
        <p className="eyebrow">Every tool</p>
        <h2 className="t-h2 mt-4">
          One audit. <span className="text-accent">Everything it takes to get found.</span>
        </h2>
        <p className="t-lead mx-auto mt-5 max-w-[52ch]">
          {liveCount} of {FEATURES.length} tools work today. The rest are planned, and we never charge for a feature before it ships.
        </p>
      </Reveal>

      <Reveal delay={0.06} className="mt-14">
        <ul className="grid overflow-hidden rounded-2xl border border-line sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((f) => {
            const Icon = f.icon;
            const live = f.status === "live";
            return (
              <li key={f.slug} className="group relative -mb-px -mr-px border-b border-r border-line p-6 transition-colors duration-200 hover:bg-white/[0.02] sm:p-7">
                <div className="flex items-start justify-between gap-3">
                  <span className={`grid size-10 place-items-center rounded-xl border ${live ? "border-cobalt/30 bg-cobalt-soft text-cobalt" : "border-line-strong text-ink-3"}`}>
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <StatusTag status={f.status} />
                </div>
                <h3 className={`mt-5 text-[16px] font-medium tracking-[-0.01em] ${live ? "text-ink" : "text-ink-2"}`}>{f.name}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-3">{f.pitch}</p>
                <p className="mt-4 font-code text-[10.5px] uppercase tracking-[0.12em] text-ink-3/80">{CHAPTERS[f.chapter].label}</p>
              </li>
            );
          })}
        </ul>
      </Reveal>

      <div className="mt-10 flex justify-center">
        <Link href="/features" className="btn-ghost inline-flex h-11 items-center gap-2 rounded-full px-5 font-sub text-[14px]">
          See how each tool works <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </div>
  );
}
