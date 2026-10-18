import type { ModuleKey, Status } from "./types";

export type Tone = "good" | "warn" | "bad";

export function scoreTone(score: number): Tone {
  if (score >= 80) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

export const TONE_LABEL: Record<Tone, string> = { good: "Strong", warn: "Needs work", bad: "Poor" };

export const TONE_TEXT: Record<Tone, string> = { good: "text-good", warn: "text-warn", bad: "text-bad" };
export const TONE_BG: Record<Tone, string> = { good: "bg-good-soft", warn: "bg-warn-soft", bad: "bg-bad-soft" };
export const TONE_STROKE: Record<Tone, string> = { good: "stroke-good", warn: "stroke-warn", bad: "stroke-bad" };

export const STATUS_TONE: Record<Exclude<Status, "info">, Tone> = { pass: "good", warn: "warn", fail: "bad" };

export const MODULES: Record<ModuleKey, { label: string; name: string; blurb: string }> = {
  seo: { label: "SEO", name: "Search engine optimization", blurb: "How well Google can crawl, understand and rank the page." },
  aeo: { label: "AEO", name: "Answer engine optimization", blurb: "Whether featured snippets and voice assistants can lift your answers." },
  geo: { label: "GEO", name: "Generative engine optimization", blurb: "Whether ChatGPT, Claude, Perplexity and Gemini can read, trust and cite you." },
  performance: { label: "Speed", name: "Performance & Core Web Vitals", blurb: "Lighthouse lab metrics on a throttled mobile device." },
  accessibility: { label: "Accessibility", name: "Accessibility & Visual Doctor", blurb: "WCAG 2.1 A and AA checks in a real browser, with problems marked on a screenshot." },
  traffic: { label: "Traffic", name: "Organic traffic estimate", blurb: "Estimated monthly visits and the keywords that drive them." },
};

export const SCORED_MODULES: ModuleKey[] = ["seo", "aeo", "geo", "performance"];

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536e6],
  ["month", 2592e6],
  ["week", 6048e5],
  ["day", 864e5],
  ["hour", 36e5],
  ["minute", 6e4],
];

/** "3 days ago", "in 2 hours", "now" */
export function ago(iso: string | Date, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  for (const [unit, ms] of STEPS) if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  return "just now";
}

export function compact(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
