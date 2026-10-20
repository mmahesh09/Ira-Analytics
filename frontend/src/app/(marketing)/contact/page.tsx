import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, Clock, Mail, MapPin } from "lucide-react";
import { MailLink } from "@/components/legal-page";
import { COMPANY, LEGAL_LINKS } from "@/lib/company";
import charminar from "../../../../public/images/charminar.webp";

export const metadata: Metadata = {
  title: "Contact",
  description: `Contact ${COMPANY.name} for support, billing, refunds and privacy requests. We're based in ${COMPANY.city}, ${COMPANY.country}.`,
};

const TOPICS = [
  ["Support and questions", "Audits, results, your account or anything that isn't working.", "Support"],
  ["Billing and refunds", "Plans, payments and refund requests. Include the payment ID from Billing.", "Billing"],
  ["Privacy and grievances", "Access, correct or delete your data, or raise a grievance.", "Privacy request"],
] as const;

/* Split contact layout (Tailark "contact-6", rebuilt on Rankwise tokens): the city on one side, every way to reach us
   on the other. The photo is public domain (Wikimedia Commons, Mir Amjad Ali Khan); no attribution required. */
export default function ContactPage() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 pb-24 pt-20 sm:px-6 lg:pt-28">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
        <figure className="relative order-last overflow-hidden rounded-[24px] border border-line lg:order-first">
          <Image
            src={charminar}
            alt="The Charminar in Hyderabad at night, lit in pink and purple against a black sky"
            placeholder="blur"
            sizes="(min-width: 1024px) 480px, 100vw"
            className="h-[420px] w-full object-cover object-[50%_30%] lg:h-full lg:min-h-[640px]"
            priority
          />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
          <figcaption className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
            <p className="eyebrow flex items-center gap-2 text-[11px] text-ink-2">
              <MapPin aria-hidden="true" className="size-3.5 text-cobalt" /> {COMPANY.city}, {COMPANY.region}
            </p>
            <p className="mt-3 max-w-[30ch] font-display text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              Built in {COMPANY.city}. <span className="text-accent">One team, one city.</span>
            </p>
            <p className="mt-2 max-w-[42ch] font-sub text-[13.5px] leading-relaxed text-ink-2">
              We have no other offices. Everything is answered by the people who build Rankwise, on India time.
            </p>
          </figcaption>
        </figure>

        <div>
          <p className="eyebrow flex items-center gap-2.5">
            <span className="size-1.5 rounded-full bg-cobalt shadow-[0_0_10px_var(--cobalt)]" /> Contact
          </p>
          <h1 className="mt-5 font-display text-[clamp(2.25rem,4.5vw,3.5rem)] font-bold leading-[1.05] tracking-[-0.03em]">
            Talk to <span className="text-accent">the team</span>
          </h1>
          <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed text-ink-2">
            One inbox for everything. Write from your account email if your question is about your account, so we can find it quickly.
          </p>

          <dl className="mt-10 divide-y divide-line rounded-2xl border border-line">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-4 sm:px-6">
              <dt className="flex items-center gap-2.5 font-sub text-[13.5px] text-ink-3">
                <Mail aria-hidden="true" className="size-4 text-cobalt" /> Email
              </dt>
              <dd className="break-all text-[15.5px]">
                <MailLink />
              </dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-4 sm:px-6">
              <dt className="flex items-center gap-2.5 font-sub text-[13.5px] text-ink-3">
                <MapPin aria-hidden="true" className="size-4 text-cobalt" /> Location
              </dt>
              <dd className="text-[15.5px]">
                {COMPANY.city}, {COMPANY.region}, {COMPANY.country} <span className="text-ink-3">(only)</span>
              </dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-4 sm:px-6">
              <dt className="flex items-center gap-2.5 font-sub text-[13.5px] text-ink-3">
                <Clock aria-hidden="true" className="size-4 text-cobalt" /> Response time
              </dt>
              <dd className="text-[15.5px]">Within 2 business days (IST)</dd>
            </div>
          </dl>

          <h2 className="mt-12 text-[20px] font-semibold tracking-[-0.02em]">What to write about</h2>
          <ul className="mt-5 grid gap-3">
            {TOPICS.map(([title, body, subject]) => (
              <li key={title}>
                <a
                  href={`mailto:${COMPANY.email}?subject=${encodeURIComponent(subject)}`}
                  className="group flex items-start justify-between gap-4 rounded-xl border border-line p-5 transition-colors duration-200 hover:border-white/[0.16] hover:bg-white/[0.02]"
                >
                  <span>
                    <span className="block text-[15.5px] font-medium text-ink">{title}</span>
                    <span className="mt-1 block font-sub text-[14px] leading-relaxed text-ink-3">{body}</span>
                    <span className="mt-3 block font-sub text-[13px] text-cobalt">Email about {subject.toLowerCase()}</span>
                  </span>
                  <ArrowUpRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-ink-3 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
                </a>
              </li>
            ))}
          </ul>

          <p className="mt-10 font-sub text-[14px] text-ink-3">
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
        </div>
      </div>
    </section>
  );
}
