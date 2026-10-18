/**
 * Pricing plans: the single source of truth for the pricing section, /pricing page and (later) backend limits.
 * Display only for now; no checkout. INR uses regional round prices, not a live FX conversion.
 */

export type Currency = "usd" | "inr";
export type PlanId = "free" | "pro" | "business";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  price: Record<Currency, number>;
  cta: string;
  highlight?: boolean;
  /** short list on the card; Business is "Everything in Pro, plus" */
  features: string[];
  featuresIntro?: string;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "For trying Rankwise on one site.",
    price: { usd: 0, inr: 0 },
    cta: "Start free",
    features: ["1 site", "10k pageviews a month", "Monthly SEO, AEO and GEO audits", "3 AI-visibility prompts", "6 months of data"],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For freelancers and growing sites.",
    price: { usd: 19, inr: 1499 },
    cta: "Start with Pro",
    highlight: true,
    features: ["5 sites", "100k pageviews a month", "Weekly audits with score history", "25 AI-visibility prompts", "3 competitors per site", "Google Search Console and GA4", "Email alerts", "2 years of data"],
  },
  {
    id: "business",
    name: "Business",
    tagline: "For agencies and teams.",
    price: { usd: 79, inr: 5999 },
    cta: "Start with Business",
    featuresIntro: "Everything in Pro, plus",
    features: ["25 sites", "1M pageviews a month", "Daily audits", "200 AI-visibility prompts", "10 competitors per site", "Priority alerts", "5 years of data"],
  },
];

/** Rows of the full comparison table on /pricing. `true` = included, `false` = not included, string = value. */
export const COMPARISON: { group: string; rows: { label: string; values: Record<PlanId, string | boolean> }[] }[] = [
  {
    group: "Usage",
    rows: [
      { label: "Sites", values: { free: "1", pro: "5", business: "25" } },
      { label: "Pageviews per month", values: { free: "10k", pro: "100k", business: "1M" } },
      { label: "Data retention", values: { free: "6 months", pro: "2 years", business: "5 years" } },
    ],
  },
  {
    group: "Audits",
    rows: [
      { label: "SEO, AEO, GEO and Speed audits", values: { free: true, pro: true, business: true } },
      { label: "Scheduled audits", values: { free: "Monthly", pro: "Weekly", business: "Daily" } },
      { label: "Score history and trends", values: { free: false, pro: true, business: true } },
    ],
  },
  {
    group: "AI visibility",
    rows: [
      { label: "Tracked prompts", values: { free: "3", pro: "25", business: "200" } },
      { label: "Competitors per site", values: { free: false, pro: "3", business: "10" } },
      { label: "AI share of voice", values: { free: false, pro: true, business: true } },
    ],
  },
  {
    group: "Traffic and integrations",
    rows: [
      { label: "Cookieless tracking script", values: { free: true, pro: true, business: true } },
      { label: "Google Search Console", values: { free: false, pro: true, business: true } },
      { label: "Google Analytics 4", values: { free: false, pro: true, business: true } },
      { label: "Alerts", values: { free: false, pro: "Email", business: "Email + priority" } },
    ],
  },
];

const FORMATTERS: Record<Currency, Intl.NumberFormat> = {
  usd: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
  inr: new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }),
};

export function formatPrice(amount: number, currency: Currency): string {
  return FORMATTERS[currency].format(amount);
}

export function isPlanId(value: string | null): value is PlanId {
  return value === "free" || value === "pro" || value === "business";
}
