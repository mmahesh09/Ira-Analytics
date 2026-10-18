"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { PLANS, formatPrice } from "@/lib/plans";
import { useCurrency } from "./currency";

export function PricingCards() {
  const currency = useCurrency();

  return (
    <div>
      <ul className="grid items-stretch gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <li
            key={plan.id}
            className={`relative flex flex-col rounded-xl p-7 ${
              plan.highlight ? "panel border-cobalt/40 shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_30px_80px_rgb(147_51_234/0.18)]" : "border border-line bg-white/[0.015]"
            }`}
          >
            {plan.highlight && <span aria-hidden="true" className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-cobalt to-transparent" />}

            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[18px] font-semibold tracking-[-0.02em]">{plan.name}</h3>
              {plan.highlight && <span className="rounded-full bg-cobalt-fill px-2.5 py-0.5 font-code text-[10.5px] uppercase tracking-[0.1em] text-white">Most popular</span>}
            </div>
            <p className="mt-1.5 text-[14px] text-ink-3">{plan.tagline}</p>

            <p className="mt-7 flex items-baseline gap-1.5">
              <span key={currency} className="price-swap font-display text-[44px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                {formatPrice(plan.price[currency], currency)}
              </span>
              <span className="font-sub text-[14px] text-ink-3">/ month</span>
            </p>

            <Link
              href={`/signup?plan=${plan.id}`}
              className={`mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-full font-sub text-[14px] font-medium transition-colors duration-150 ${
                plan.highlight ? "btn-brand" : "btn-ghost"
              }`}
            >
              {plan.cta} <ArrowRight aria-hidden="true" className="size-4" />
            </Link>

            <div className="mt-7 border-t border-line pt-6">
              {plan.featuresIntro && <p className="mb-3 font-sub text-[13px] text-ink-2">{plan.featuresIntro}</p>}
              <ul className="space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-[14.5px] leading-snug text-ink-2">
                    <Check aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${plan.highlight ? "text-cobalt" : "text-ink-3"}`} /> {f}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-6 font-sub text-[13px] text-ink-3">Billed monthly through Razorpay. Cancel anytime and keep access until the end of the period.</p>
    </div>
  );
}
