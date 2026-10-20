"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * One IntersectionObserver for every [data-reveal] on the page. A MutationObserver also picks up [data-reveal]
 * elements inserted later (streamed segments, client navigation, Fast Refresh remounts), which would otherwise stay
 * hidden because they mount without `.in`.
 */
export function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
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

    const track = (root: ParentNode) => {
      const items = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]:not(.in)"));
      if (root instanceof HTMLElement && root.matches("[data-reveal]:not(.in)")) items.push(root);
      for (const el of items) {
        // already on screen: show immediately so nothing visible blinks out when hiding starts
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("in");
        else io.observe(el);
      }
    };

    track(document);
    document.documentElement.classList.add("reveal-ready");

    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) for (const node of m.addedNodes) if (node instanceof HTMLElement) track(node);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [pathname]);

  return null;
}
