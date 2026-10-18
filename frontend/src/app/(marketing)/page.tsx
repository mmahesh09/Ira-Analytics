import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { HeroPreview } from "@/components/hero-preview";
import { UrlForm } from "@/components/url-form";
import { Reveal } from "@/components/reveal";
import { FAQ, type FAQItem } from "@/components/ui/faq-section";
import { SectionHead } from "@/components/section-head";
import { CurrencyToggle } from "@/components/pricing/currency";
import { PricingCards } from "@/components/pricing/pricing-cards";
import {
  A11yVisual,
  ChapterHead,
  ChatVisual,
  ContentVisual,
  DoctorVisual,
  FeatureBento,
  FixVisual,
  LinksVisual,
  OpportunityVisual,
  ReportSpread,
  ScoreVisual,
  StatusTag,
} from "@/components/marketing/chapters";
import { MonitorScene } from "@/components/marketing/monitor-scene";
import { AuditConsole } from "@/components/marketing/audit-console";
import { FEATURES, byChapter, liveCount } from "@/lib/features";

const ENGINES = ["Google", "ChatGPT", "Claude", "Perplexity", "Gemini", "Bing", "Copilot"];

const FAQS: FAQItem[] = [
  {
    question: "What do SEO, AEO and GEO mean?",
    answer:
      "SEO is ranking in classic search results. AEO (answer engine optimization) is being quoted in featured snippets, People Also Ask and voice answers. GEO (generative engine optimization) is being read, trusted and cited by AI assistants like ChatGPT, Claude, Perplexity and Gemini.",
  },
  {
    question: "Can Rankwise see my real traffic?",
    answer:
      "No tool can see another site's private analytics. The Traffic view shows modelled estimates from a keyword-ranking provider. Connecting Google Search Console for real numbers is on the roadmap.",
  },
  {
    question: "How is the overall score calculated?",
    answer:
      "Every check is weighted by impact. The overall score blends SEO (35%), GEO (25%), AEO (20%) and Speed (20%). If a module can't run, the others are re-weighted. Traffic is reported but never scored.",
  },
  {
    question: "Will an audit affect my site?",
    answer:
      "An audit is lightweight: one page fetch, robots.txt, sitemap and llms.txt, plus up to 25 internal link checks. Speed is measured by Google's PageSpeed service, not from our servers.",
  },
  {
    question: "Why does GEO matter if I already rank on Google?",
    answer:
      "More people now get answers straight from AI assistants. If those assistants can't crawl your pages, or don't recognise your brand as an entity, you can rank well and still be missing from the answer.",
  },
];

/** Chapter wrapper: generous Apple-scale rhythm, light or dark. */
function Chapter({ id, light, children }: { id?: string; light?: boolean; children: React.ReactNode }) {
  return (
    // overflow-x: clip (not hidden) so rotated mockups can't widen the page and sticky scenes still work
    <section id={id} className={`${light ? "theme-light" : "bg-paper"} relative scroll-mt-16 overflow-x-clip`}>
      <div className="mx-auto max-w-[1200px] px-4 py-28 sm:px-6 lg:py-40">{children}</div>
    </section>
  );
}

export default function Home() {
  const understand = byChapter("understand");
  // lead with the most visual feature
  const understandOrdered = [understand.find((f) => f.slug === "chat")!, ...understand.filter((f) => f.slug !== "chat")];

  return (
    <>
      {/* HERO: split, left-aligned headline + the live audit console (signature) */}
      <section id="audit" className="relative scroll-mt-16 overflow-hidden">
        <div aria-hidden="true" className="stars absolute inset-0 opacity-60" />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-14 px-4 pb-20 pt-16 sm:px-6 lg:min-h-[calc(100svh-3.5rem-57px)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16 lg:py-20">
          <div>
            <Reveal load>
              <p className="eyebrow flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="flex items-center gap-2.5">
                  <span className="size-1.5 rounded-full bg-cobalt shadow-[0_0_10px_var(--cobalt)]" /> SEO · AEO · GEO audits
                </span>
                <span aria-hidden="true" className="hidden h-px w-8 bg-white/15 sm:block" />
                <Link href="/features" className="flex items-center gap-1 transition-colors hover:text-ink">
                  {FEATURES.length} tools <ArrowUpRight aria-hidden="true" className="size-3.5" />
                </Link>
              </p>
            </Reveal>
            {/* no entrance on the headline: it is the LCP element and must paint with the first frame */}
            <div>
              <h1 className="mt-7 font-display text-[clamp(3.25rem,7.4vw,6rem)] font-bold leading-[0.95] tracking-[-0.035em]">
                <span className="block text-ink">Search.</span>
                <span className="block text-ink">Answers.</span>
                <span className="block text-ink">AI.</span>
                <span className="text-accent mt-4 block pb-1 text-[clamp(1.5rem,2.6vw,2.125rem)] font-semibold leading-tight tracking-[-0.03em]">
                  Get found in all three.
                </span>
              </h1>
            </div>
            <Reveal load delay={0.1}>
              <p className="mt-6 max-w-[46ch] text-[clamp(1.0625rem,1.4vw,1.1875rem)] leading-relaxed text-ink-3">
                Rankwise checks how Google, answer engines and AI assistants read your site, ranks every fix by impact and hands you the code.
              </p>
            </Reveal>
            <Reveal load delay={0.15} className="mt-9">
              <UrlForm autoFocus />
            </Reveal>
            <Reveal load delay={0.2}>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 font-sub text-[14px] text-ink-3">
                {["Free audit", "No signup", "About a minute"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check aria-hidden="true" className="size-4 text-good" /> {t}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <div className="min-w-0">
            <AuditConsole />
          </div>
        </div>

        {/* engine strip: the hero's mono footer */}
        <div className="relative border-t border-white/[0.06]">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-10 gap-y-3 px-4 py-5 sm:px-6">
            <p className="eyebrow flex items-center gap-2.5 text-[11px]">
              <span className="size-1.5 rounded-full bg-good" /> Measured against
            </p>
            <ul className="flex flex-wrap items-center gap-x-8 gap-y-2 font-code text-[12px] uppercase tracking-[0.14em] text-ink-3">
              {ENGINES.map((e, i) => (
                <li key={e} className="flex items-center gap-2">
                  <span className="text-ink-3/60">{String(i + 1).padStart(2, "0")}</span> {e}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* PRODUCT: the full report, tilted, as a breathing visual between hero and chapters */}
      <section className="relative overflow-x-clip border-t border-white/[0.06]">
        <div className="mx-auto max-w-[1200px] px-4 pt-28 sm:px-6 lg:pt-36">
          <Reveal className="mx-auto max-w-[760px] text-center">
            <p className="eyebrow">The report</p>
            <h2 className="mt-5 text-[clamp(2.25rem,5vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.03em]">
              <span className="text-gradient pb-1">Every engine.</span> <span className="text-accent pb-1">One list of fixes.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-[50ch] text-[18px] leading-relaxed text-ink-3">
              Findings from SEO, answer engines, AI crawlers, speed and accessibility, ranked by what each fix is worth.
            </p>
          </Reveal>
          <div className="mt-16 hidden sm:block">
            <HeroPreview />
          </div>
        </div>
      </section>

      {/* 1. DETECT (dark) */}
      <Chapter id="checks">
        <ChapterHead chapter="detect" count={byChapter("detect").length} />
        <div className="mt-16 lg:mt-20">
          <FeatureBento
            features={byChapter("detect")}
            visuals={{ "health-score": <ScoreVisual />, "broken-links": <LinksVisual />, accessibility: <A11yVisual />, "visual-doctor": <DoctorVisual /> }}
          />
        </div>
      </Chapter>

      {/* 2. PRIORITISE & FIX (light) */}
      <Chapter id="fix" light>
        <ChapterHead chapter="fix" count={byChapter("fix").length} />
        <div className="mt-16 lg:mt-20">
          <FeatureBento
            features={byChapter("fix")}
            visuals={{ "opportunity-finder": <OpportunityVisual />, "one-click-fixes": <FixVisual />, "ai-content": <ContentVisual /> }}
          />
        </div>
      </Chapter>

      {/* 3. VERIFY & MONITOR (dark, sticky scroll scene) */}
      <Chapter id="how">
        <ChapterHead chapter="monitor" count={byChapter("monitor").length} />
        <div className="mt-10">
          <MonitorScene />
        </div>
      </Chapter>

      {/* 4. UNDERSTAND (light) */}
      <Chapter id="understand" light>
        <ChapterHead chapter="understand" count={understand.length} />
        <div className="mt-16 lg:mt-20">
          <FeatureBento features={understandOrdered} visuals={{ chat: <ChatVisual /> }} />
        </div>
      </Chapter>

      {/* 5. REPORT (dark) */}
      <Chapter id="reports">
        <div className="grid items-center gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div>
            <ChapterHead chapter="report" count={byChapter("report").length} />
            <ul className="mt-10 space-y-5">
              {byChapter("report").map((f) => (
                <li key={f.slug} className="border-t border-line pt-5">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-[20px] font-semibold tracking-[-0.02em]">{f.name}</h3>
                    <StatusTag status={f.status} />
                  </div>
                  <p className="mt-1 text-[16px] text-ink-3">{f.pitch}</p>
                </li>
              ))}
            </ul>
          </div>
          <Reveal delay={0.1}>
            <ReportSpread />
          </Reveal>
        </div>
      </Chapter>

      {/* the whole list, one line each */}
      <section className="theme-light relative">
        <div className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <Reveal>
              <p className="eyebrow">Everything included</p>
              <h2 className="mt-5 max-w-[22ch] text-[clamp(2.25rem,5vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.03em]">
                <span className="text-gradient pb-1">{FEATURES.length} tools.</span> <span className="text-accent pb-1">One subscription.</span>
              </h2>
            </Reveal>
            <Link href="/features" className="btn-ghost inline-flex h-10 items-center gap-1.5 rounded-full px-4 font-sub text-[14px]">
              {liveCount} live today, see them all <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
          <ul className="mt-12 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <li key={f.slug} className="flex items-center justify-between gap-3 border-t border-line py-3.5">
                <span className="flex min-w-0 items-center gap-2.5 text-[15px]">
                  <f.icon aria-hidden="true" className="size-4 shrink-0 text-cobalt" />
                  <span className="truncate">{f.name}</span>
                </span>
                {f.status === "live" ? (
                  <span className="flex shrink-0 items-center gap-1.5 font-code text-[10.5px] uppercase tracking-[0.12em] text-good">
                    <span className="size-1.5 rounded-full bg-good" /> Live
                  </span>
                ) : (
                  <span className="shrink-0 font-code text-[10.5px] uppercase tracking-[0.12em] text-ink-3">Soon</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* PRICING (dark) */}
      <section id="pricing" className="relative scroll-mt-16 bg-surface-ink">
        <div aria-hidden="true" className="seam absolute inset-x-0 top-0" />
        <div className="mx-auto max-w-[1200px] px-4 py-28 sm:px-6 lg:py-36">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHead label="Pricing" title="Start free. Upgrade when it pays for itself." />
            <Reveal delay={0.06}>
              <CurrencyToggle />
            </Reveal>
          </div>
          <Reveal delay={0.08} className="mt-14">
            <PricingCards />
          </Reveal>
          <Link href="/pricing" className="mt-3 inline-flex items-center gap-1.5 font-sub text-[14px] text-ink-2 transition-colors hover:text-ink">
            Compare every feature <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </div>
      </section>

      {/* FAQ (light) */}
      <section id="faq" className="theme-light relative scroll-mt-16">
        <FAQ
          title="Questions, answered."
          description="What the scores mean, where the data comes from and what an audit actually does to your site."
          items={FAQS}
          cta={{ label: "Run a free audit", href: "/#audit" }}
        />
      </section>

      {/* FINAL CTA (dark) */}
      <section className="relative overflow-hidden border-t border-line">
        <div aria-hidden="true" className="stars absolute inset-0 opacity-50" />
        <div aria-hidden="true" className="console-glow absolute left-1/2 top-1/2 h-[520px] w-[900px] max-w-full -translate-x-1/2 -translate-y-1/2" />
        <div className="relative mx-auto max-w-[1200px] px-4 py-28 text-center sm:px-6 lg:py-40">
          <Reveal>
            <h2 className="mx-auto max-w-[16ch] text-[clamp(2.75rem,7vw,5.5rem)] font-semibold leading-[1] tracking-[-0.035em]">
              <span className="text-gradient block pb-2">Find out what</span>
              <span className="text-accent block pb-2">AI says about you.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mx-auto mb-10 mt-6 max-w-[40ch] text-[clamp(1.125rem,1.6vw,1.375rem)] text-ink-3">Any public site, anywhere. Your first audit takes about a minute.</p>
          </Reveal>
          <Reveal delay={0.14}>
            <UrlForm align="center" />
          </Reveal>
        </div>
      </section>
    </>
  );
}
