import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage, MailLink, type LegalSection } from "@/components/legal-page";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Refund and cancellation policy",
  description: "Rankwise subscriptions can be cancelled anytime and aren't refunded; unused credit packs are refundable within 7 days.",
};

const SECTIONS: LegalSection[] = [
  {
    id: "subscriptions",
    heading: "Subscriptions",
    body: (
      <ul>
        <li>You can cancel a paid plan anytime from Billing. It won&rsquo;t renew, and you keep it, with its credits, until the end of the period you paid for.</li>
        <li>Subscription payments, including the first one and renewals, are not refunded, in full or in part.</li>
        <li>After the paid period ends, your account moves to the Free plan; your websites and reports stay.</li>
      </ul>
    ),
  },
  {
    id: "packs",
    heading: "Credit packs",
    body: (
      <ul>
        <li>A credit pack can be refunded in full within 7 days of purchase, if none of its credits have been used.</li>
        <li>Once any credit from a pack has been used, or after 7 days, the pack isn&rsquo;t refundable.</li>
      </ul>
    ),
  },
  {
    id: "errors",
    heading: "Failed audits and billing errors",
    body: (
      <ul>
        <li>If an audit can&rsquo;t produce a report, its credits are returned to your balance automatically. No request is needed.</li>
        <li>If you were charged twice or charged in error, we refund the extra charge in full.</li>
      </ul>
    ),
  },
  {
    id: "how",
    heading: "How to ask for a refund",
    body: (
      <p>
        Email <MailLink subject="Refund request" /> from your account email with the payment ID shown in Billing &rarr; Payment history. We reply within 2
        business days. Approved refunds go back to the original payment method through Razorpay, usually within 5&ndash;7 business days, depending on your bank.
      </p>
    ),
  },
  {
    id: "more",
    heading: "More information",
    body: (
      <p>
        These rules are part of our <Link href="/terms" className="text-ink underline underline-offset-4">terms of service</Link>. {COMPANY.name},{" "}
        {COMPANY.city}, {COMPANY.region}, {COMPANY.country}.
      </p>
    ),
  },
];

export default function RefundPolicyPage() {
  return (
    <LegalPage
      label="Refunds"
      title="Refund and cancellation policy"
      current="/refund-policy"
      intro={<p>No refunds on subscriptions, cancel anytime and keep your plan until the period ends. Unused credit packs can be refunded within 7 days.</p>}
      sections={SECTIONS}
    />
  );
}
