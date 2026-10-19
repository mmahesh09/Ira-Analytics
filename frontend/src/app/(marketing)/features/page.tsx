import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { StatusTag } from "@/components/marketing/chapters";
import { CHAPTERS, FEATURES, byChapter, liveCount, type Chapter } from "@/lib/features";

export const metadata: Metadata = {
  title: "Features",
  description: "Every Rankwise tool for SEO, answer engines and AI visibility: what's live today and what's coming next.",
};

const ORDER: Chapter[] = ["detect", "fix", "monitor", "understand", "report"];

export default function FeaturesPage() {
  return (
    <div className="theme-light">
      <section className="mx-auto max-w-[1200px] px-4 pb-16 pt-20 sm:px-6 lg:pt-32">
        <Reveal load>
          <p className="eyebrow flex items-center gap-2.5">
            <span className="size-1.5 rounded-full bg-cobalt shadow-[0_0_10px_var(--cobalt)]" /> Features
          </p>
          <h1 className="mt-6 max-w-[14ch] font-display text-[clamp(2.75rem,5.6vw,4.75rem)] font-bold leading-[1.02] tracking-[-0.035em]">
            <span className="text-gradient pb-2">{FEATURES.length} tools.</span> <span className="text-accent pb-2">One loop.</span>
          </h1>
          <p className="mt-6 max-w-[48ch] text-[clamp(1.125rem,1.6vw,1.375rem)] leading-relaxed text-ink-3">
            Detect, prioritise, fix, verify and monitor. {liveCount} are live today; the rest are on the way, and we&apos;ll never charge for something that isn&apos;t built.
          </p>
        </Reveal>
      </section>

      {ORDER.map((chapter) => (
        <section key={chapter} aria-labelledby={`ch-${chapter}`} className="mx-auto max-w-[1200px] border-t border-line px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Reveal>
              <p className="eyebrow text-cobalt">{String(ORDER.indexOf(chapter) + 1).padStart(2, "0")}</p>
              <h2 id={`ch-${chapter}`} className="mt-3 text-[28px] font-semibold tracking-[-0.025em]">
                {CHAPTERS[chapter].label}
              </h2>
              <p className="mt-2 max-w-[32ch] text-[16px] leading-relaxed text-ink-3">{CHAPTERS[chapter].body}</p>
            </Reveal>
            <Reveal delay={0.05}>
              <ul className="grid gap-4 sm:grid-cols-2">
                {byChapter(chapter).map((f) => (
                  <li
                    key={f.slug}
                    className={`flex h-full flex-col rounded-2xl p-6 ${
                      f.status === "live" ? "panel transition-[border-color] duration-200 hover:border-white/[0.16]" : "border border-dashed border-line-strong"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className={`grid size-10 place-items-center rounded-xl ${f.status === "live" ? "border border-cobalt/20 bg-cobalt-soft" : "border border-line-strong"}`}>
                        <f.icon aria-hidden="true" className={`size-5 ${f.status === "live" ? "text-cobalt" : "text-ink-3"}`} />
                      </span>
                      <StatusTag status={f.status} />
                    </div>
                    <h3 className={`mt-5 text-[19px] font-semibold tracking-[-0.02em] ${f.status === "live" ? "" : "text-ink-2"}`}>{f.name}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-ink-3">{f.pitch}</p>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>
      ))}

      <section className="mx-auto max-w-[1200px] border-t border-line px-4 py-24 text-center sm:px-6">
        <h2 className="mx-auto max-w-[18ch] text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-[1.04] tracking-[-0.03em]">
          <span className="text-gradient pb-1">Start with</span> <span className="text-accent pb-1">a free audit.</span>
        </h2>
        <Link href="/#audit" className="mt-8 inline-flex h-12 items-center gap-2 btn-brand rounded-full px-7 font-sub text-[16px] font-medium">
          Audit my site <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </section>
    </div>
  );
}
