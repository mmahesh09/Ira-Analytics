import Link from "next/link";
import type { Metadata } from "next";
import { Mail, MapPin, Clock } from "lucide-react";
import { MailLink } from "@/components/legal-page";
import { COMPANY, LEGAL_LINKS } from "@/lib/company";

export const metadata: Metadata = {
  title: "Contact",
  description: `Contact ${COMPANY.name} for support, billing, refunds and privacy requests.`,
};

const TOPICS = [
  ["Support and questions", "Audits, results, your account or anything that isn't working.", "Support"],
  ["Billing and refunds", "Plans, payments and refund requests. Include the payment ID from Billing.", "Billing"],
  ["Privacy and grievances", "Access, correct or delete your data, or raise a grievance.", "Privacy request"],
] as const;

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 pb-24 pt-20 sm:px-6 lg:pt-28">
      <p className="eyebrow flex items-center gap-2.5">
        <span className="size-1.5 rounded-full bg-cobalt shadow-[0_0_10px_var(--cobalt)]" /> Contact
      </p>
      <h1 className="mt-5 font-display text-[clamp(2.25rem,4.5vw,3.5rem)] font-bold leading-[1.05] tracking-[-0.03em]">Talk to us</h1>
      <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed text-ink-2">
        One inbox for everything. Write from your account email if your question is about your account, so we can find it quickly.
      </p>

      <dl className="mt-12 grid gap-4 md:grid-cols-3">
        <div className="panel rounded-xl p-6">
          <dt className="flex items-center gap-2 font-sub text-[13px] text-ink-3">
            <Mail aria-hidden="true" className="size-4 text-cobalt" /> Email
          </dt>
          <dd className="mt-2 break-all text-[16px]">
            <MailLink />
          </dd>
        </div>
        <div className="panel rounded-xl p-6">
          <dt className="flex items-center gap-2 font-sub text-[13px] text-ink-3">
            <MapPin aria-hidden="true" className="size-4 text-cobalt" /> Location
          </dt>
          <dd className="mt-2 text-[16px]">
            {COMPANY.city}, {COMPANY.region}, {COMPANY.country}
          </dd>
        </div>
        <div className="panel rounded-xl p-6">
          <dt className="flex items-center gap-2 font-sub text-[13px] text-ink-3">
            <Clock aria-hidden="true" className="size-4 text-cobalt" /> Response time
          </dt>
          <dd className="mt-2 text-[16px]">Within 2 business days</dd>
        </div>
      </dl>

      <h2 className="mt-16 text-[22px] font-semibold tracking-[-0.02em]">What to write about</h2>
      <ul className="mt-6 grid gap-4 md:grid-cols-3">
        {TOPICS.map(([title, body, subject]) => (
          <li key={title} className="rounded-xl border border-line p-6">
            <p className="text-[16px] font-medium">{title}</p>
            <p className="mt-1.5 font-sub text-[14px] leading-relaxed text-ink-3">{body}</p>
            <a
              href={`mailto:${COMPANY.email}?subject=${encodeURIComponent(subject)}`}
              className="mt-4 inline-flex font-sub text-[14px] text-ink underline decoration-white/30 underline-offset-4 hover:decoration-white"
            >
              Email about {subject.toLowerCase()}
            </a>
          </li>
        ))}
      </ul>

      <p className="mt-12 font-sub text-[14px] text-ink-3">
        Policies:{" "}
        {LEGAL_LINKS.filter(([, href]) => href !== "/contact").map(([text, href], i, all) => (
          <span key={href}>
            <Link href={href} className="text-ink-2 hover:text-ink">
              {text}
            </Link>
            {i < all.length - 1 ? " · " : ""}
          </span>
        ))}
      </p>
    </section>
  );
}
