"use client";

import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { COMPARISON, PLANS, formatPrice } from "@/lib/plans";
import { useCurrency } from "./currency";

/* Plan comparison (Tailark "comparator-2" layout, rebuilt on Rankwise tokens): plan header with price and a CTA per plan,
   grouped feature rows, the recommended plan as a tinted column. Data comes from COMPARISON in lib/plans. */

function Cell({ value, highlight }: { value: string | boolean; highlight?: boolean }) {
  if (value === true)
    return (
      <>
        <span className={`mx-auto grid size-5 place-items-center rounded-full ${highlight ? "bg-cobalt-fill text-white" : "bg-white/[0.08] text-ink"}`}>
          <Check aria-hidden="true" className="size-3" strokeWidth={3} />
        </span>
        <span className="sr-only">Included</span>
      </>
    );
  if (value === false)
    return (
      <>
        <Minus aria-hidden="true" className="mx-auto size-4 text-white/20" />
        <span className="sr-only">Not included</span>
      </>
    );
  return <span className={`tabular-nums ${highlight ? "text-ink" : "text-ink-2"}`}>{value}</span>;
}

export function CompareTable() {
  const currency = useCurrency();
  const tint = (highlight?: boolean) => (highlight ? "bg-cobalt/[0.06]" : "");

  return (
    <div className="relative overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[820px] border-collapse font-sub text-[14px]">
        <caption className="sr-only">Compare plans</caption>
        <thead>
          <tr className="border-b border-line align-bottom">
            <th scope="col" className="w-[30%] px-6 pb-6 pt-8 text-left align-bottom font-normal">
              <span className="block font-display text-[22px] font-semibold tracking-[-0.02em] text-ink">Compare plans</span>
              <span className="mt-1 block text-[13px] text-ink-3">Every plan includes the full audit engine.</span>
            </th>
            {PLANS.map((p) => (
              <th key={p.id} scope="col" className={`relative px-5 pb-6 pt-8 text-left font-normal ${tint(p.highlight)}`}>
                {p.highlight && (
                  <>
                    <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-cobalt" />
                    <span className="mb-2 inline-flex rounded-full border border-cobalt/40 bg-cobalt-soft px-2 py-0.5 font-code text-[10px] uppercase tracking-[0.12em] text-cobalt">
                      Recommended
                    </span>
                  </>
                )}
                <span className="block text-[15px] font-medium text-ink">{p.name}</span>
                <span className="mt-2 flex items-baseline gap-1">
                  <span className="font-display text-[26px] font-semibold tracking-[-0.03em] text-ink tabular-nums">{formatPrice(p.price[currency], currency)}</span>
                  <span className="text-[12.5px] text-ink-3">/ mo</span>
                </span>
                <span className="mt-1 block min-h-[2.5em] text-[12.5px] leading-snug text-ink-3">{p.tagline}</span>
                <Link
                  href={`/signup?plan=${p.id}`}
                  className={`mt-4 inline-flex h-9 w-full items-center justify-center rounded-full px-4 text-[13px] font-medium ${p.highlight ? "btn-brand" : "btn-ghost"}`}
                >
                  {p.cta}
                  <span className="sr-only"> on {p.name}</span>
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        {COMPARISON.map((section) => (
          <tbody key={section.group}>
            <tr>
              <th colSpan={1} scope="colgroup" className="px-6 pb-2 pt-8 text-left font-normal">
                <span className="font-code text-[11px] uppercase tracking-[0.12em] text-cobalt">{section.group}</span>
                {section.note && <span className="mt-1 block text-[12.5px] text-ink-3">{section.note}</span>}
              </th>
              {PLANS.map((p) => (
                <td key={p.id} aria-hidden="true" className={tint(p.highlight)} />
              ))}
            </tr>
            {section.rows.map((row) => (
              <tr key={row.label} className="border-t border-line transition-colors hover:bg-white/[0.015]">
                <th scope="row" className="px-6 py-3.5 text-left font-normal text-ink-2">
                  {row.label}
                </th>
                {PLANS.map((p) => (
                  <td key={p.id} className={`px-5 py-3.5 text-center ${tint(p.highlight)}`}>
                    <Cell value={row.values[p.id]} highlight={p.highlight} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
