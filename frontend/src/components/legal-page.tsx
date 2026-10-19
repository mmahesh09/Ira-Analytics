import Link from "next/link";
import type { ReactNode } from "react";
import { COMPANY, LEGAL_LINKS } from "@/lib/company";

export interface LegalSection {
  id: string;
  heading: string;
  body: ReactNode;
}

/** Shared layout for the legal pages: title, last-updated date, a contents list, then numbered sections. */
export function LegalPage({ label, title, intro, sections, current }: { label: string; title: string; intro: ReactNode; sections: LegalSection[]; current: string }) {
  return (
    <article className="mx-auto max-w-[1200px] px-4 pb-24 pt-20 sm:px-6 lg:pt-28">
      <header className="max-w-[72ch]">
        <p className="eyebrow flex items-center gap-2.5">
          <span className="size-1.5 rounded-full bg-cobalt shadow-[0_0_10px_var(--cobalt)]" /> {label}
        </p>
        <h1 className="mt-5 font-display text-[clamp(2.25rem,4.5vw,3.5rem)] font-bold leading-[1.05] tracking-[-0.03em]">{title}</h1>
        <p className="mt-3 font-sub text-[14px] text-ink-3">Last updated {COMPANY.legalUpdated}</p>
        <div className="mt-6 text-[16.5px] leading-relaxed text-ink-2">{intro}</div>
      </header>

      <div className="mt-14 grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow text-[11px]">On this page</p>
          <ol className="mt-3 space-y-1.5 font-sub text-[14px]">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-ink-3 transition-colors hover:text-ink">
                  {i + 1}. {s.heading}
                </a>
              </li>
            ))}
          </ol>
          <p className="eyebrow mt-8 text-[11px]">Other policies</p>
          <ul className="mt-3 space-y-1.5 font-sub text-[14px]">
            {LEGAL_LINKS.filter(([, href]) => href !== current).map(([text, href]) => (
              <li key={href}>
                <Link href={href} className="text-ink-3 transition-colors hover:text-ink">
                  {text}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="max-w-[72ch] space-y-12">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-24">
              <h2 id={`${s.id}-h`} className="text-[22px] font-semibold tracking-[-0.02em]">
                <span className="mr-2 font-code text-[15px] text-cobalt">{String(i + 1).padStart(2, "0")}</span>
                {s.heading}
              </h2>
              <div className="mt-4 space-y-4 text-[16px] leading-relaxed text-ink-2 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_strong]:text-ink [&_ul]:space-y-2">{s.body}</div>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}

/** A mailto link to the business address, styled for body text. */
export function MailLink({ subject }: { subject?: string }) {
  const href = `mailto:${COMPANY.email}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
  return (
    <a href={href} className="text-ink underline decoration-white/30 underline-offset-4 hover:decoration-white">
      {COMPANY.email}
    </a>
  );
}
