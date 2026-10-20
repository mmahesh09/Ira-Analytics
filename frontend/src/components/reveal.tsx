import type { CSSProperties, ReactNode } from "react";

/**
 * Fade-up entrance with no per-instance JavaScript.
 * - default: revealed when scrolled into view by the single <RevealObserver /> in the marketing layout
 * - `load`: plays a CSS keyframe on first paint, for above-the-fold content (no wait for hydration)
 * Content stays visible without JS and with reduced motion (see globals.css).
 */
export function Reveal({ children, delay = 0, className, y = 24, load = false }: { children: ReactNode; delay?: number; className?: string; y?: number; load?: boolean }) {
  const style = { "--d": `${delay}s`, "--y": `${y}px` } as CSSProperties;
  return (
    // RevealObserver adds `.in` to this element, sometimes before a late-streamed segment hydrates: an expected
    // className difference, so React is told not to warn about it (this element's attributes only, not its children)
    <div className={className} style={style} suppressHydrationWarning {...(load ? { "data-enter": "" } : { "data-reveal": "" })}>
      {children}
    </div>
  );
}
