import Link from "next/link";
import { ArrowUp } from "lucide-react";
import { COMPANY, LEGAL_LINKS } from "@/lib/company";
import { Logo } from "./site-header";

const NAV = [
  {
    title: "Product",
    links: [
      ["Run a free audit", "/#audit"],
      ["Features", "/features"],
      ["How it works", "/#how"],
      ["Pricing", "/pricing"],
    ],
  },
  {
    title: "Learn",
    links: [
      ["What we check", "/#checks"],
      ["Roadmap", "/#roadmap"],
      ["FAQ", "/#faq"],
    ],
  },
  {
    title: "Account",
    links: [
      ["Log in", "/login"],
      ["Create an account", "/signup"],
    ],
  },
  { title: "Legal", links: LEGAL_LINKS },
] as const;

/** Quiet footer: brand + three link groups, clearly separated from the page (item 60). No competing CTA. */
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface-ink">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_2fr] lg:gap-16 lg:py-20">
        <div>
          <Link href="/" aria-label="Rankwise home" className="inline-flex h-10 items-center">
            <Logo />
          </Link>
          <p className="mt-4 max-w-[36ch] text-[15px] leading-relaxed text-ink-3">
            SEO, answer-engine and AI-search readiness audits with every fix ranked and the code to ship it.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {NAV.map((group) => (
            <div key={group.title}>
              <h2 className="font-sub text-[14px] font-medium text-ink">{group.title}</h2>
              <ul className="mt-3">
                {group.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="-mx-2 inline-flex min-h-10 items-center rounded-md px-2 font-sub text-[15px] text-ink-3 transition-colors duration-200 hover:text-ink">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-6 font-sub text-[13px] text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {COMPANY.legalUpdated.slice(-4)} {COMPANY.name}, {COMPANY.city}, {COMPANY.country}. Speed data from Google PageSpeed Insights.
          </p>
          <a href="#main" className="-mx-2 inline-flex min-h-10 shrink-0 items-center gap-1.5 self-start rounded-md px-2 transition-colors duration-200 hover:text-ink sm:self-auto">
            Back to top <ArrowUp aria-hidden="true" className="size-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
