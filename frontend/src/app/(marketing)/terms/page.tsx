import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage, MailLink, type LegalSection } from "@/components/legal-page";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms for using Rankwise: accounts, acceptable use, plans and credits, payments, and liability.",
};

const SECTIONS: LegalSection[] = [
  {
    id: "agreement",
    heading: "Agreement",
    body: (
      <p>
        These terms are an agreement between you and {COMPANY.name}, operated from {COMPANY.city}, {COMPANY.region}, {COMPANY.country}. By creating an
        account or using the service you accept them. If you use {COMPANY.name} for an organisation, you confirm you can accept them on its behalf.
      </p>
    ),
  },
  {
    id: "service",
    heading: "The service",
    body: (
      <p>
        {COMPANY.name} audits websites for SEO, answer-engine and AI-search readiness, speed and accessibility, suggests fixes and monitors changes. Scores,
        estimates and AI suggestions are guidance based on automated checks; they can be incomplete or wrong, and they don&rsquo;t guarantee rankings,
        traffic or compliance with any law.
      </p>
    ),
  },
  {
    id: "account",
    heading: "Your account",
    body: (
      <ul>
        <li>You must be at least 18 and give accurate details. Keep your password secret; you&rsquo;re responsible for activity in your account.</li>
        <li>Tell us at <MailLink subject="Account security" /> if you think someone else has accessed it.</li>
      </ul>
    ),
  },
  {
    id: "use",
    heading: "Acceptable use",
    body: (
      <>
        <p>You may only add and audit websites you own or are authorised to test. You must not:</p>
        <ul>
          <li>use the service to probe, attack, overload or scrape websites or networks you&rsquo;re not authorised to;</li>
          <li>try to get around plan limits, credit charges or preview limits, or access other users&rsquo; data;</li>
          <li>interfere with the service, reverse-engineer it beyond what the law allows, or resell it without our written permission;</li>
          <li>use it for anything unlawful.</li>
        </ul>
        <p>We may suspend accounts that break these rules.</p>
      </>
    ),
  },
  {
    id: "plans",
    heading: "Plans and credits",
    body: (
      <ul>
        <li>
          Each plan includes a number of websites and full-audit credits per month, as shown on the <Link href="/pricing" className="text-ink underline underline-offset-4">pricing page</Link>.
          A full audit uses 1 credit and a deep audit 3; light checks and opening saved reports don&rsquo;t use credits.
        </li>
        <li>Monthly credits expire at the end of each month or billing period and don&rsquo;t roll over. Credit-pack credits last 12 months from purchase.</li>
        <li>If an audit can&rsquo;t produce a report, its credits are returned automatically.</li>
        <li>Credits have no cash value and can&rsquo;t be transferred.</li>
      </ul>
    ),
  },
  {
    id: "payments",
    heading: "Payments and renewal",
    body: (
      <ul>
        <li>Paid plans are billed monthly in advance through Razorpay and renew automatically until you cancel.</li>
        <li>Prices are shown in INR (and USD where available) and charged at the listed amount.</li>
        <li>If a renewal payment fails, Razorpay retries it for a few days; if it still fails, your account moves to the Free plan.</li>
        <li>
          You can cancel anytime in Billing and keep your plan until the end of the paid period. Refunds follow our{" "}
          <Link href="/refund-policy" className="text-ink underline underline-offset-4">refund policy</Link>.
        </li>
        <li>We may change prices with at least 30 days&rsquo; notice; changes apply from your next renewal.</li>
      </ul>
    ),
  },
  {
    id: "content",
    heading: "Your content",
    body: (
      <p>
        Your websites, reports and settings stay yours. You let us process them only to provide the service. We handle personal data as described in the{" "}
        <Link href="/privacy" className="text-ink underline underline-offset-4">privacy policy</Link>.
      </p>
    ),
  },
  {
    id: "availability",
    heading: "Availability and changes",
    body: (
      <p>
        We work to keep {COMPANY.name} available but don&rsquo;t guarantee uninterrupted service; maintenance, third-party outages or limits (for example on
        speed testing) can affect results. We may improve or change features; we won&rsquo;t remove a paid feature during a period you&rsquo;ve already paid for.
      </p>
    ),
  },
  {
    id: "liability",
    heading: "Liability",
    body: (
      <p>
        The service is provided &ldquo;as is&rdquo;. To the extent the law allows, {COMPANY.name} isn&rsquo;t liable for indirect or consequential losses, such
        as lost profits, traffic or data, and our total liability for any claim is limited to the amount you paid us in the 12 months before it arose. Nothing
        here limits liability that can&rsquo;t be limited by law.
      </p>
    ),
  },
  {
    id: "ending",
    heading: "Ending the agreement",
    body: (
      <p>
        You can stop using {COMPANY.name} and ask us to delete your account at any time. We may suspend or close accounts that seriously or repeatedly break
        these terms, and will tell you why unless the law or security prevents it.
      </p>
    ),
  },
  {
    id: "law",
    heading: "Governing law",
    body: (
      <p>
        These terms are governed by the laws of India. Disputes are subject to the courts of {COMPANY.city}, {COMPANY.region}. Please contact us first at{" "}
        <MailLink subject="Terms" />; most issues can be settled quickly.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      label="Terms"
      title="Terms of service"
      current="/terms"
      intro={<p>Plain-language terms for using {COMPANY.name}. Please read them before creating an account or buying a plan.</p>}
      sections={SECTIONS}
    />
  );
}
