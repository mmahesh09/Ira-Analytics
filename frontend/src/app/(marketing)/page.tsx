import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
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
      {/* HERO: light product spotlight */}
      <section id="audit" className="theme-light relative scroll-mt-16 overflow-hidden">
        <div className="mx-auto max-w-[1200px] px-4 pt-20 text-center sm:px-6 lg:pt-32">
          <Reveal load>
            <Link href="/features" className="inline-flex items-center gap-1.5 font-sub text-[15px] text-cobalt hover:underline">
              {FEATURES.length} tools for search, answer engines and AI <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          </Reveal>
          <Reveal load delay={0.05}>
            <h1 className="text-gradient mx-auto mt-6 max-w-[14ch] pb-2 text-[clamp(3.25rem,9vw,7rem)] font-semibold leading-[0.98] tracking-[-0.055em]">
              Your website, on autopilot.
            </h1>
          </Reveal>
          <Reveal load delay={0.1}>
            <p className="mx-auto mt-7 max-w-[44ch] text-[clamp(1.125rem,1.8vw,1.5rem)] leading-relaxed text-ink-3">
              Find every SEO, answer-engine and AI-visibility problem. Fix it with ready-made code. Know the day anything slips.
            </p>
          </Reveal>
          <Reveal load delay={0.15} className="mt-10">
            <UrlForm autoFocus align="center" />
          </Reveal>
          <Reveal load delay={0.2}>
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-sub text-[14px] text-ink-3">
              {["Free audit", "No signup", "About a minute"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check aria-hidden="true" className="size-4 text-good" /> {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <div className="mt-16 hidden text-left sm:block lg:mt-20">
            <HeroPreview />
          </div>
        </div>
        <div className="mx-auto max-w-[1200px] px-4 pb-24 pt-6 sm:px-6">
          <p className="text-center font-sub text-[14px] text-ink-3">Measured against how these engines read your site</p>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 font-display text-[22px] font-semibold tracking-[-0.03em] text-ink/30">
            {ENGINES.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
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
              <h2 className="text-gradient max-w-[16ch] pb-1 text-[clamp(2.25rem,5vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.045em]">
                {FEATURES.length} tools. One subscription.
              </h2>
            </Reveal>
            <Link href="/features" className="inline-flex items-center gap-1.5 font-sub text-[15px] text-cobalt hover:underline">
              {liveCount} live today, see them all <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
          <ul className="mt-12 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <li key={f.slug} className="flex items-center justify-between gap-3 border-t border-line py-3.5">
                <span className="flex min-w-0 items-center gap-2.5 text-[15px]">
                  <f.icon aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
                  <span className="truncate">{f.name}</span>
                </span>
                {f.status === "live" ? <span className="size-1.5 shrink-0 rounded-full bg-good" title="Live" /> : <span className="shrink-0 font-sub text-[11px] text-ink-3">Soon</span>}
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
        <div aria-hidden="true" className="top-light absolute inset-0" />
        <div className="relative mx-auto max-w-[1200px] px-4 py-28 text-center sm:px-6 lg:py-40">
          <Reveal>
            <h2 className="text-gradient mx-auto max-w-[16ch] pb-2 text-[clamp(2.75rem,7vw,5.5rem)] font-semibold leading-[1] tracking-[-0.05em]">
              Find out what AI says about you.
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
