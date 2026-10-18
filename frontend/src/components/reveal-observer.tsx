"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** One IntersectionObserver for every [data-reveal] on the page. */
export function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]:not(.in)"));
    // already on screen: show immediately so nothing visible blinks out when hiding starts
    for (const el of items) if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("in");
    document.documentElement.classList.add("reveal-ready");

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -80px 0px" },
    );
    for (const el of items) if (!el.classList.contains("in")) io.observe(el);
    return () => io.disconnect();
  }, [pathname]);

  return null;
}
