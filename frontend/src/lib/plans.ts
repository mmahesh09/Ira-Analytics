/**
 * Pricing plans for the pricing page, the landing page and Billing. Display copy only: the server-side source
 * of truth (limits, credits, enforcement) is backend/app/plans.py, and backend/tests/test_billing.py pins the
 * same numbers. Every line here is something that works today; nothing unbuilt is listed.
 * INR uses regional round prices, not a live FX conversion.
 */

export type Currency = "usd" | "inr";
export type PlanId = "free" | "pro" | "business" | "scale";

/** Credits per full audit; light checks cost nothing. Mirrors CREDIT_COST in backend/app/plans.py. */
export const AUDIT_COST = 1;
export const DEEP_AUDIT_COST = 3;
export const DEEP_AUDIT_PAGES = 500;

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  price: Record<Currency, number>;
  /** full-audit credits granted each month (no rollover) */
  credits: number;
  sites: number;
  cta: string;
  highlight?: boolean;
  featuresIntro?: string;
  features: string[];
  notIncluded?: string[];
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Try Rankwise on one website.",
    price: { usd: 0, inr: 0 },
    credits: 1,
    sites: 1,
    cta: "Start free",
    features: ["1 full audit every month", "Weekly light checks", "Broken links on up to 10 pages per audit", "Fix suggestions and issue history"],
    notIncluded: ["Credit packs", "Deep audits"],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For freelancers and small business sites.",
    price: { usd: 19, inr: 1499 },
    credits: 3,
    sites: 3,
    cta: "Start with Pro",
    highlight: true,
    features: ["3 full audits every month", "Daily light checks, up to 10 a day", "Broken links on up to 50 pages per audit", "Buy extra credits when you need them"],
    notIncluded: ["Deep audits"],
  },
  {
    id: "business",
    name: "Business",
    tagline: "For agencies looking after client sites.",
    price: { usd: 79, inr: 5999 },
    credits: 7,
    sites: 10,
    cta: "Start with Business",
    featuresIntro: "Everything in Pro, plus",
    features: ["7 full audits every month", `Deep audits: ${DEEP_AUDIT_PAGES} pages for ${DEEP_AUDIT_COST} credits`, "Up to 40 light checks a day", "Broken links on up to 100 pages per audit"],
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "For larger portfolios of websites.",
    price: { usd: 149, inr: 11999 },
    credits: 11,
    sites: 25,
    cta: "Start with Scale",
    featuresIntro: "Everything in Business, plus",
    features: ["11 full audits every month", "25 websites", "Up to 100 light checks a day"],
  },
];

/** One-time credit packs for paid plans. Mirrors PACKS in backend/app/plans.py. */
export const PACKS: { id: string; credits: number; price: Record<Currency, number> }[] = [
  { id: "pack_5", credits: 5, price: { usd: 15, inr: 1199 } },
  { id: "pack_20", credits: 20, price: { usd: 49, inr: 3999 } },
];

/** Rows of the full comparison table on /pricing. `true` = included, `false` = not included, string = value. */
export const COMPARISON: { group: string; note?: string; rows: { label: string; values: Record<PlanId, string | boolean> }[] }[] = [
  {
    group: "Usage",
    rows: [
      { label: "Websites", values: { free: "1", pro: "3", business: "10", scale: "25" } },
      { label: "Full-audit credits each month", values: { free: "1", pro: "3", business: "7", scale: "11" } },
      { label: "Extra credit packs", values: { free: false, pro: true, business: true, scale: true } },
    ],
  },
  {
    group: "Full audits",
    note: `${AUDIT_COST} credit each. Opening a saved report never uses credits.`,
    rows: [
      { label: "SEO, AEO, GEO and Speed scores", values: { free: true, pro: true, business: true, scale: true } },
      { label: "Pages checked for broken links", values: { free: "10", pro: "50", business: "100", scale: "100" } },
      { label: `Deep audit (${DEEP_AUDIT_PAGES} pages, ${DEEP_AUDIT_COST} credits)`, values: { free: false, pro: false, business: true, scale: true } },
      { label: "Fix suggestions with ready-to-paste code", values: { free: true, pro: true, business: true, scale: true } },
    ],
  },
  {
    group: "Light checks",
    note: "Fast SEO, AEO and GEO rule checks between full audits. They never use credits.",
    rows: [
      { label: "Scheduled light checks", values: { free: "Weekly", pro: "Daily", business: "Daily", scale: "Daily" } },
      { label: "Light checks per day, all sites", values: { free: "3", pro: "10", business: "40", scale: "100" } },
      { label: "“Mark fixed” rechecks", values: { free: true, pro: true, business: true, scale: true } },
      { label: "Deploy webhook (full audit, or a light check without credits)", values: { free: true, pro: true, business: true, scale: true } },
    ],
  },
  {
    group: "History",
    rows: [
      { label: "Score history, issue history and in-app alerts", values: { free: true, pro: true, business: true, scale: true } },
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
  return value === "free" || value === "pro" || value === "business" || value === "scale";
}

export const planById = (id: PlanId): Plan => PLANS.find((p) => p.id === id) ?? PLANS[0];
