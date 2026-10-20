"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import ReceiptPrinter from "@/components/kokonutui/receipt-printer";
import type { Currency } from "@/lib/plans";
import type { PaymentRow } from "@/lib/types";

/** One payment, in major units (rupees or dollars). */
export interface Receipt {
  id: string;
  description: string;
  amount: number;
  currency: Currency;
  paidAt: Date;
}

const SYMBOL: Record<Currency, string> = { inr: "₹", usd: "$" };
const stamp = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function receiptFromPayment(p: PaymentRow): Receipt {
  return {
    id: p.id,
    description: p.description ?? (p.kind === "pack" ? "Audit credit pack" : "Rankwise subscription"),
    amount: p.amount / 100, // stored in paise / cents
    currency: p.currency,
    paidAt: p.paid_at ? new Date(p.paid_at) : new Date(),
  };
}

/** The payment receipt, printed by the Kokonut UI receipt printer. Not a tax invoice. */
export function ReceiptDialog({ receipt, onClose }: { receipt: Receipt | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (receipt && !dialog.open) dialog.showModal();
    if (!receipt && dialog.open) dialog.close();
  }, [receipt]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="receipt-title"
      className="m-auto rounded-3xl border border-line-strong bg-surface p-0 text-ink shadow-[var(--shadow-lg)] backdrop:bg-black/70"
    >
      {receipt && (
        <div className="p-5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h2 id="receipt-title" className="text-[18px] font-semibold tracking-[-0.02em]">
                Payment receipt
              </h2>
              <p className="mt-0.5 font-sub text-[13px] text-ink-3">
                {SYMBOL[receipt.currency]}
                {receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {receipt.description}
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close receipt" className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-2 hover:bg-white/[0.06] hover:text-ink">
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <ReceiptPrinter
            key={receipt.id}
            className="mx-auto mt-4 border-white/[0.08] dark:bg-paper"
            merchant="Rankwise"
            order={receipt.id}
            date={stamp.format(receipt.paidAt)}
            items={[{ name: receipt.description, quantity: 1, price: receipt.amount }]}
            tax={0}
            currency={SYMBOL[receipt.currency]}
            note="Thank you for choosing Rankwise"
          />
          <p className="mt-3 max-w-72 font-sub text-[12px] leading-relaxed text-ink-3">
            Payment ID {receipt.id}. Processed by Razorpay. This is a payment receipt, not a tax invoice.
          </p>
        </div>
      )}
    </dialog>
  );
}
