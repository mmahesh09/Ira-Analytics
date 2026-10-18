"use client";

import { useEffect, useState } from "react";
import { animate, m, useReducedMotion } from "framer-motion";
import { scoreTone, TONE_STROKE, TONE_TEXT } from "@/lib/format";

/** Counts from 0 to `value` once mounted (instant with reduced motion). */
export function CountUp({ value, duration = 1.1 }: { value: number; duration?: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, value, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [value, duration, reduce]);
  return <>{reduce ? value : shown}</>;
}

/** Circular score gauge. The number is always shown, so colour is never the only signal. */
export function ScoreRing({ score, size = 120, stroke = 10, label }: { score: number; size?: number; stroke?: number; label: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const tone = scoreTone(score);
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${score} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-white/[0.07]" />
        <m.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={TONE_STROKE[tone]}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className={`absolute font-mono font-medium ${TONE_TEXT[tone]}`} style={{ fontSize: size * 0.3 }}>
        <CountUp value={score} />
      </span>
    </div>
  );
}
