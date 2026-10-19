"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

/** Desktop links with a visible current-page state. */
export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="hidden items-center gap-1 font-sub text-[14px] md:flex">
      {NAV.map((item) => {
        const current = !item.href.includes("#") && pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`inline-flex h-10 items-center rounded-full px-4 transition-colors duration-150 ${
              current ? "bg-white/[0.07] text-ink" : "text-ink-2 hover:bg-white/[0.05] hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Phone menu: a full-width sheet under the header with every link and both account actions. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
        className="grid size-11 cursor-pointer place-items-center rounded-full text-ink-2 transition-colors hover:bg-white/[0.06] hover:text-ink"
      >
        {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
      </button>
      {open && (
        <div id="mobile-menu" className="absolute inset-x-0 top-full z-40 border-b border-line bg-paper px-4 pb-6 pt-2 shadow-[0_24px_48px_rgb(0_0_0/0.6)]">
          <nav aria-label="Mobile" className="flex flex-col font-sub text-[16px]">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={!item.href.includes("#") && pathname === item.href ? "page" : undefined}
                className="flex h-12 items-center border-b border-line text-ink-2 hover:text-ink aria-[current=page]:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Link href="/login" onClick={() => setOpen(false)} className="btn-ghost inline-flex h-12 items-center justify-center rounded-full font-sub text-[15px]">
              Log in
            </Link>
            <Link href="/signup" onClick={() => setOpen(false)} className="btn-brand inline-flex h-12 items-center justify-center rounded-full font-sub text-[15px] font-medium">
              Start free
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
