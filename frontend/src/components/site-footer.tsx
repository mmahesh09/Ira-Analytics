"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUp, Check, Copy } from "lucide-react";

const ROBOTS = `# Let AI assistants read and cite you
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /`;

const NAV = [
  {
    title: "Product",
    links: [
      ["Run an audit", "/#audit"],
      ["What we check", "/#checks"],
      ["How it works", "/#how"],
      ["Pricing", "/pricing"],
      ["FAQ", "/#faq"],
    ],
  },
  {
    title: "Learn",
    links: [
      ["SEO explained", "/#seo"],
      ["AEO explained", "/#aeo"],
      ["GEO explained", "/#geo"],
    ],
  },
] as const;

function RobotsSnippet() {
  const [copied, setCopied] = useState(false);
  return (
    <figure className="panel mt-8 overflow-hidden rounded-xl">
      <figcaption className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="font-sub text-[13px] text-ink-3">robots.txt</span>
        <button
          type="button"
          onClick={() =>
            navigator.clipboard?.writeText(ROBOTS).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            })
          }
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-3 font-sub text-[13px] font-medium text-ink-2 transition-colors duration-200 hover:bg-surface-3 hover:text-ink"
        >
          {copied ? <Check aria-hidden="true" className="size-4 text-good" /> : <Copy aria-hidden="true" className="size-4" />}
          <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </button>
      </figcaption>
      <pre className="overflow-x-auto px-4 py-4 font-[ui-monospace,SFMono-Regular,Menlo,Consolas,monospace] text-[13px] leading-[1.7] text-ink-2">
        {ROBOTS.split("\n").map((line, i) => (
          <span key={i} className="block">
            {line.startsWith("#") ? (
              <span className="text-ink-3">{line}</span>
            ) : line.startsWith("User-agent") ? (
              <>
                <span className="text-cobalt">User-agent:</span>
                {line.slice(11)}
              </>
            ) : line.startsWith("Allow") ? (
              <>
                <span className="text-good">Allow:</span>
                {line.slice(6)}
              </>
            ) : (
              line || " "
            )}
          </span>
        ))}
      </pre>
    </figure>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface-ink">
      <div className="mx-auto grid max-w-[1200px] gap-16 px-4 py-20 sm:px-6 lg:grid-cols-[1.25fr_1fr] lg:gap-24 lg:py-24">
        <div>
          <p className="flex items-center gap-2 font-sub text-[13px] text-ink-3">
            <span className="size-1.5 rounded-full bg-cobalt shadow-[0_0_8px_var(--cobalt)]" />
            Before you go
          </p>
          <h2 className="mt-3 text-[clamp(1.75rem,3vw,2.25rem)] font-semibold leading-[1.15] tracking-[-0.025em]">Let the AI crawlers in.</h2>
          <p className="mt-3 max-w-[48ch] text-[17px] leading-relaxed text-ink-2">
            Many sites block the very assistants they want to be cited by. Add these lines to your robots.txt, then run an audit to confirm.
          </p>
          <RobotsSnippet />
        </div>

        <div className="flex flex-col justify-between gap-12">
          <nav aria-label="Footer" className="grid grid-cols-2 gap-8">
            {NAV.map((group) => (
              <div key={group.title}>
                <h3 className="font-sub text-[13px] font-medium uppercase tracking-[0.12em] text-ink-3">{group.title}</h3>
                <ul className="mt-4">
                  {group.links.map(([label, href]) => (
                    <li key={label}>
                      <Link
                        href={href}
                        className="-mx-2 inline-flex min-h-10 items-center rounded-md px-2 font-sub text-[15px] text-ink-2 transition-colors duration-200 hover:text-ink"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <p className="max-w-[44ch] text-[14px] leading-relaxed text-ink-3">
            Data from Google PageSpeed Insights, DataForSEO Labs and OpenRouter models. Traffic figures are estimates and AI answers vary between runs.
          </p>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-6 font-sub text-[13px] text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© Rankwise · SEO, AEO &amp; GEO audits</p>
          <a href="#main" className="-mx-2 inline-flex min-h-10 items-center gap-1.5 self-start rounded-md px-2 transition-colors duration-200 hover:text-ink sm:self-auto">
            Back to top <ArrowUp aria-hidden="true" className="size-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
