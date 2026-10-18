import Link from "next/link";

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <rect width="24" height="24" rx="6" fill="#f7f8f8" />
        <path d="M6 17V7h5.2a3.3 3.3 0 0 1 .7 6.5L15 17h-2.6l-2.8-3.3H8.2V17H6Zm2.2-5.2h2.9a1.4 1.4 0 0 0 0-2.8H8.2v2.8Z" fill="#08090a" />
      </svg>
      <span className="font-display text-[15px] font-semibold tracking-[-0.02em]">Rankwise</span>
    </span>
  );
}

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/#how", label: "Monitoring" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-paper/[0.92] backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto grid h-14 max-w-[1200px] grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6">
        <Link href="/" aria-label="Rankwise home" className="justify-self-start rounded-md">
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 font-sub text-[13.5px] md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-md px-3 py-1.5 text-ink-3 transition-colors duration-150 hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="col-start-3 flex items-center gap-1 justify-self-end">
          <Link href="/login" className="inline-flex h-8 items-center rounded-lg px-3 font-sub text-[13px] text-ink-3 transition-colors duration-150 hover:text-ink">
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-8 items-center btn-brand rounded-lg px-3.5 font-sub text-[13px] font-medium"
          >
            Start free
          </Link>
        </div>
      </div>
    </header>
  );
}
