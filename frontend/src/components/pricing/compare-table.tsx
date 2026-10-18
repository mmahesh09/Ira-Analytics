"use client";

import { Check, Minus } from "lucide-react";
import { COMPARISON, PLANS, formatPrice } from "@/lib/plans";
import { useCurrency } from "./currency";

function Cell({ value }: { value: string | boolean }) {
  if (value === true)
    return (
      <>
        <Check aria-hidden="true" className="mx-auto size-4 text-ink" />
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
  return <span className="text-ink-2">{value}</span>;
}

export function CompareTable() {
  const currency = useCurrency();

  return (
    <div className="relative overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[640px] border-collapse font-sub text-[14px]">
        <caption className="sr-only">Compare plans</caption>
        <thead className="bg-white/[0.02]">
          <tr className="border-b border-line">
            <th scope="col" className="w-[40%] px-5 py-4 text-left font-normal text-ink-3">
              Features
            </th>
            {PLANS.map((p) => (
              <th key={p.id} scope="col" className={`px-5 py-4 text-center ${p.highlight ? "bg-white/[0.03]" : ""}`}>
                <span className="block text-[15px] font-medium text-ink">{p.name}</span>
                <span className="mt-0.5 block text-[13px] font-normal text-ink-3 tabular-nums">{formatPrice(p.price[currency], currency)} / mo</span>
              </th>
            ))}
          </tr>
        </thead>
        {COMPARISON.map((section) => (
          <tbody key={section.group}>
            <tr>
              <th colSpan={4} scope="colgroup" className="px-5 pb-2 pt-7 text-left text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">
                {section.group}
              </th>
            </tr>
            {section.rows.map((row) => (
              <tr key={row.label} className="border-t border-line">
                <th scope="row" className="px-5 py-3.5 text-left font-normal text-ink-2">
                  {row.label}
                </th>
                {PLANS.map((p) => (
                  <td key={p.id} className={`px-5 py-3.5 text-center ${p.highlight ? "bg-white/[0.03]" : ""}`}>
                    <Cell value={row.values[p.id]} />
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
