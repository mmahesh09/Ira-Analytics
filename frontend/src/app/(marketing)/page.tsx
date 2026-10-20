import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
  ContentVisual,
  DoctorVisual,
  FeatureBento,
  FixVisual,
  LinksVisual,
  OpportunityVisual,
  ScoreVisual,
} from "@/components/marketing/chapters";
import { MonitorScene } from "@/components/marketing/monitor-scene";
import { AuditConsole } from "@/components/marketing/audit-console";
import { HeroStats } from "@/components/marketing/hero-stats";
import { FeaturesOverview } from "@/components/marketing/features-overview";
import { FeedbackBand } from "@/components/marketing/feedback-band";
import { byChapter } from "@/lib/features";

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

/** One section rhythm for the whole page (item 51): same vertical padding, same container. */
function Chapter({ id, children, tint }: { id?: string; children: React.ReactNode; tint?: boolean }) {
  return (
    // overflow-x: clip (not hidden) so rotated mockups can't widen the page and sticky scenes still work
    <section id={id} className={`relative scroll-mt-16 overflow-x-clip border-t border-line ${tint ? "bg-surface-ink" : "bg-paper"}`}>
      <div className="section-y mx-auto max-w-[1200px] px-4 sm:px-6">{children}</div>
    </section>
  );
}

/** Small "sample data" chip so demo visuals are never mistaken for a real account (item 50). */
function SampleTag({ children = "Sample data" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-paper/80 px-2.5 py-1 font-sub text-[12px] text-ink-2 backdrop-blur">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-warn" /> {children}
    </span>
  );
}

const STEPS = ["Paste your website address", "We run 35+ checks in about a minute", "Get every fix ranked, with the code"];

export default function Home() {
  return (
    <>
      {/* HERO: split layout, one job (run an audit) */}
      <section id="audit" className="relative scroll-mt-16 overflow-hidden">
        <div aria-hidden="true" className="stars absolute inset-0 opacity-30" />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-16 lg:pb-24 lg:pt-20">
          <div>
            <Reveal load>
              <p className="eyebrow flex items-center gap-2.5">
                <span className="size-1.5 rounded-full bg-cobalt shadow-[0_0_10px_var(--cobalt)]" /> SEO, AEO &amp; GEO audits
              </p>
            </Reveal>
            {/* no entrance on the headline: it is the LCP element and must paint with the first frame */}
            <h1 className="mt-6 font-display text-[clamp(2.5rem,4.6vw,4rem)] font-bold leading-[1.04] tracking-[-0.035em]">
              <span className="block text-ink">Get found on Google</span>
              <span className="text-accent block pb-1">and in AI answers.</span>
            </h1>
            <Reveal load delay={0.1}>
              <p className="t-lead mt-6 max-w-[48ch]">
                Rankwise checks how Google, answer engines and AI assistants like ChatGPT read your site, then ranks every fix by impact and gives you the code.
              </p>
            </Reveal>
            <Reveal load delay={0.15} className="mt-9">
              <UrlForm showLabel />
            </Reveal>
            <Reveal load delay={0.2}>
              {/* what happens next (item 10) */}
              <ol className="grid gap-2 font-sub text-[14px] text-ink-2 sm:grid-cols-3 sm:gap-4">
                {STEPS.map((step, i) => (
                  <li key={step} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-cobalt/40 font-code text-[11px] text-cobalt">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
          <div className="min-w-0">
            <AuditConsole />
          </div>
        </div>

        {/* stats band: only numbers we can stand behind (item 9) */}
        <HeroStats engines={ENGINES} />
      </section>

      {/* PRODUCT: the full report, as one calm visual */}
      <section className="relative overflow-x-clip border-t border-line bg-surface-ink">
        <div className="mx-auto max-w-[1200px] px-4 pt-24 sm:px-6 lg:pt-32">
          <Reveal className="mx-auto max-w-[720px] text-center">
            <p className="eyebrow">The report</p>
            <h2 className="t-h2 mt-4">
              <span className="text-gradient pb-1">Every engine.</span> <span className="text-accent pb-1">One list of fixes.</span>
            </h2>
            <p className="t-lead mx-auto mt-5 max-w-[52ch]">
              Findings from SEO, answer engines, AI crawlers, speed and accessibility, ranked by what each fix is worth.
            </p>
          </Reveal>
          <div className="relative mt-14 hidden sm:block">
            <div className="absolute right-4 top-4 z-10">
              <SampleTag>Sample report</SampleTag>
            </div>
            <HeroPreview />
          </div>
        </div>
      </section>

      {/* 01 DETECT */}
      <Chapter id="checks">
        <ChapterHead chapter="detect" count={byChapter("detect").length} />
        <div className="mt-14">
          <FeatureBento
            features={byChapter("detect")}
            visuals={{ "health-score": <ScoreVisual />, "broken-links": <LinksVisual />, accessibility: <A11yVisual />, "visual-doctor": <DoctorVisual /> }}
          />
        </div>
      </Chapter>

      {/* 02 PRIORITISE & FIX */}
      <Chapter id="fix" tint>
        <ChapterHead chapter="fix" count={byChapter("fix").length} />
        <div className="mt-14">
          <FeatureBento
            features={byChapter("fix")}
            visuals={{ "opportunity-finder": <OpportunityVisual />, "one-click-fixes": <FixVisual />, "ai-content": <ContentVisual /> }}
          />
        </div>
      </Chapter>

      {/* 03 VERIFY & MONITOR (sticky scroll scene) */}
      <Chapter id="how">
        <ChapterHead chapter="monitor" count={byChapter("monitor").length} />
        <div className="mt-10">
          <MonitorScene />
        </div>
      </Chapter>

      {/* EVERY TOOL: live tools first, planned ones visibly tagged (item 66) */}
      <Chapter id="roadmap" tint>
        <FeaturesOverview />
      </Chapter>

      {/* PRICING */}
      <section id="pricing" className="relative scroll-mt-16 border-t border-line bg-paper">
        <div className="section-y mx-auto max-w-[1200px] px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHead label="Pricing" title="Start free. Upgrade when it pays for itself." />
            <Reveal delay={0.06}>
              <CurrencyToggle />
            </Reveal>
          </div>
          <Reveal delay={0.08} className="mt-12">
            <PricingCards />
          </Reveal>
          <Link href="/pricing" className="mt-4 inline-flex min-h-10 items-center gap-1.5 font-sub text-[14px] text-ink-2 transition-colors hover:text-ink">
            Compare every feature <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative scroll-mt-16 border-t border-line bg-surface-ink">
        <FAQ
          title="Questions, answered."
          description="What the scores mean, where the data comes from and what an audit actually does to your site."
          items={FAQS}
        />
      </section>

      {/* FEEDBACK: invitation to the 3-step form; answers land in the team's Google Sheet */}
      <FeedbackBand />

      {/* FINAL CTA: one action only (item 99) */}
      <section className="relative overflow-hidden border-t border-line">
        <div aria-hidden="true" className="console-glow absolute left-1/2 top-1/2 h-[480px] w-[860px] max-w-full -translate-x-1/2 -translate-y-1/2" />
        <div className="section-y relative mx-auto max-w-[1200px] px-4 text-center sm:px-6">
          <Reveal>
            <h2 className="mx-auto max-w-[16ch] font-display text-[clamp(2.5rem,5.6vw,4.25rem)] font-semibold leading-[1.04] tracking-[-0.035em]">
              <span className="text-gradient block pb-1">Find out what</span>
              <span className="text-accent block pb-1">AI says about you.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="t-lead mx-auto mb-10 mt-5 max-w-[40ch]">Any public site. Your first audit is free and takes about a minute.</p>
          </Reveal>
          <Reveal delay={0.14}>
            <UrlForm align="center" />
          </Reveal>
        </div>
      </section>
    </>
  );
}
