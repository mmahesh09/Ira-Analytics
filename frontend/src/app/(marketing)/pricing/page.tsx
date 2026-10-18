import type { Metadata } from "next";
import { SectionHead } from "@/components/section-head";
import { Reveal } from "@/components/reveal";
import { CurrencyToggle } from "@/components/pricing/currency";
import { PricingCards } from "@/components/pricing/pricing-cards";
import { CompareTable } from "@/components/pricing/compare-table";
import { FAQ, type FAQItem } from "@/components/ui/faq-section";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Rankwise is free for one site. Pro and Business add more sites, weekly or daily audits, AI-visibility tracking and Google integrations.",
};

const FAQS: FAQItem[] = [
  {
    question: "Is the Free plan really free?",
    answer: "Yes. One site, 10k pageviews a month and monthly audits, with no card and no time limit.",
  },
  {
    question: "Can I change plans later?",
    answer: "Yes. You can move between plans at any time, and your sites and history stay exactly where they are.",
  },
  {
    question: "How does billing work?",
    answer: "Paid plans renew every month through Razorpay. Pay by card, UPI Autopay or netbanking in INR; international cards can pay in USD where available.",
  },
  {
    question: "How do I cancel?",
    answer: "From Billing in your workspace, at any time. You keep your plan until the end of the period you've paid for, then move to Free with your data intact.",
  },
];

export default function PricingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="top-light absolute inset-0" />
        <div className="relative mx-auto max-w-[1200px] px-4 pb-20 pt-20 sm:px-6 lg:pt-28">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHead as="h1" label="Pricing" title="Simple plans. Start free." body="Free for one site. Upgrade when you need more sites, faster audits and AI-visibility tracking." />
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
