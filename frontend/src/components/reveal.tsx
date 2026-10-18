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
    <div className={className} style={style} {...(load ? { "data-enter": "" } : { "data-reveal": "" })}>
      {children}
    </div>
  );
}
