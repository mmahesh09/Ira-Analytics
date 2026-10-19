import type { Metadata } from "next";
import { SectionHead } from "@/components/section-head";
import { Reveal } from "@/components/reveal";
import { CurrencyToggle } from "@/components/pricing/currency";
import { PricingCards } from "@/components/pricing/pricing-cards";
import { CompareTable } from "@/components/pricing/compare-table";
import { FAQ, type FAQItem } from "@/components/ui/faq-section";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Rankwise is free for one website with a full audit every month. Pro, Business and Scale add websites, monthly audit credits and daily light checks.",
};

const FAQS: FAQItem[] = [
  {
    question: "What is an audit credit?",
    answer:
      "One credit runs one full audit of a website: SEO, AEO, GEO and Speed scores, every issue with its fix, and a broken-link crawl sized by your plan. A deep audit on Business and Scale crawls up to 500 pages for 3 credits. If an audit can't produce a report, the credit comes back automatically.",
  },
  {
    question: "What are light checks?",
    answer:
      "Fast SEO, AEO and GEO rule checks that run on your schedule between full audits, and when you click “Mark fixed”. They never use credits; each plan has a daily limit. Speed and broken links are measured by full audits.",
  },
  {
    question: "Do unused credits roll over?",
    answer: "Monthly credits don't: each month (or billing period) starts fresh. Credits from packs are kept separately, are used after your monthly credits, and last 12 months.",
  },
  {
    question: "Can I buy more credits?",
    answer: "Yes, on any paid plan: 5 credits or 20 credits as a one-time purchase, without changing your plan.",
  },
  {
    question: "Is the Free plan really free?",
    answer: "Yes. One website and one full audit every month, plus weekly light checks, with no card and no time limit.",
  },
  {
    question: "What if a payment fails?",
    answer: "Razorpay retries it for a few days and you keep your plan meanwhile. If it still fails, the account moves to Free; credits already granted stay usable until they expire, and nothing is deleted.",
  },
  {
    question: "Which currencies can I pay in?",
    answer: "INR by card, UPI Autopay or netbanking, at the listed price. USD for international cards is offered only where it's enabled; INR prices are set locally, not converted live.",
  },
  {
    question: "Can I get a refund?",
    answer:
      "Subscriptions aren't refunded, but you can cancel anytime and keep your plan until the end of the period you've paid for. A credit pack can be refunded within 7 days of purchase if none of its credits have been used; write to us from the contact page.",
  },
  {
    question: "How do I cancel?",
    answer: "From Billing in your workspace, at any time. You keep your plan until the end of the period you've paid for, then move to Free with your sites and reports intact.",
  },
];

export default function PricingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="top-light absolute inset-0" />
        <div className="relative mx-auto max-w-[1200px] px-4 pb-20 pt-20 sm:px-6 lg:pt-28">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHead
              as="h1"
              label="Pricing"
              title="Simple plans. Start free."
              body="Every plan includes full audits with fixes and free light checks in between. Pay for more websites and more audits, nothing else."
            />
            <Reveal delay={0.06}>
              <CurrencyToggle />
            </Reveal>
          </div>
          <Reveal delay={0.08} className="mt-14">
            <PricingCards />
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="compare" className="relative border-t border-line bg-surface-ink">
        <div aria-hidden="true" className="seam absolute inset-x-0 top-0" />
        <div className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6">
          <h2 id="compare" className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold tracking-[-0.025em]">
            Compare every feature
          </h2>
          <div className="mt-10">
            <CompareTable />
          </div>
        </div>
      </section>

      <section className="relative border-t border-line">
        <div aria-hidden="true" className="seam absolute inset-x-0 top-0" />
        <FAQ title="Pricing questions" description="What's included, what changes later and what we charge today." items={FAQS} cta={{ label: "Create a free account", href: "/signup" }} />
      </section>
    </>
  );
}
