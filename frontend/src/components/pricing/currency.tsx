"use client";

import { useSyncExternalStore, type KeyboardEvent } from "react";
import type { Currency } from "@/lib/plans";

// One shared store so every price on the page (cards, table) switches together.
const KEY = "rw_currency";
const listeners = new Set<() => void>();
let current: Currency | null = null;

function initial(): Currency {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "usd" || saved === "inr") return saved;
  } catch {}
  try {
    // some browsers still report the legacy "Asia/Calcutta" name
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === "Asia/Kolkata" || tz === "Asia/Calcutta") return "inr";
  } catch {}
  return "usd";
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => (current ??= initial());
const getServerSnapshot = (): Currency => "usd";

export function setCurrency(value: Currency) {
  current = value;
  try {
    localStorage.setItem(KEY, value);
  } catch {}
  listeners.forEach((l) => l());
}

export function useCurrency(): Currency {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const OPTIONS: { value: Currency; label: string }[] = [
  { value: "usd", label: "USD $" },
  { value: "inr", label: "INR ₹" },
];

export function CurrencyToggle() {
  const currency = useCurrency();

  function onKeyDown(event: KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    setCurrency(currency === "usd" ? "inr" : "usd");
  }

  return (
    <div role="radiogroup" aria-label="Currency" onKeyDown={onKeyDown} className="inline-flex rounded-full border border-white/[0.1] bg-white/[0.03] p-1">
      {OPTIONS.map((o) => {
        const checked = currency === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => setCurrency(o.value)}
            className={`h-9 cursor-pointer rounded-full px-4 font-sub text-[13.5px] transition-colors duration-150 ${checked ? "bg-cobalt-fill font-medium text-white" : "text-ink-3 hover:text-ink"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
