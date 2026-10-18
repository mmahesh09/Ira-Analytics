"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { PLANS, formatPrice, isPlanId, type Currency, type PlanId } from "@/lib/plans";
import type { Billing } from "@/lib/types";
import { CurrencyToggle, useCurrency } from "@/components/pricing/currency";
import { PageHeader } from "./site-pages";
import { useWorkspace } from "./app-shell";

type Subscribe = { subscription_id: string; key_id: string; plan: PlanId; currency: Currency; prefill: Record<string, string> };
type CheckoutSuccess = { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string };
type RazorpayInstance = { open(): void; on(event: string, cb: (resp: { error?: { description?: string } }) => void): void };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/** Loads Razorpay Checkout only when someone actually upgrades. */
function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Couldn't load Razorpay. Check your connection or disable ad blockers for this page."));
    document.body.appendChild(script);
  });
}

const noSubscribe = () => () => {};
const readWantedPlan = () => new URLSearchParams(window.location.search).get("plan");

const STATUS: Record<string, { label: string; tone: string }> = {
  active: { label: "Active", tone: "text-good" },
  authenticated: { label: "Starting", tone: "text-good" },
  pending: { label: "Payment retrying", tone: "text-warn" },
  halted: { label: "Payment failed", tone: "text-bad" },
};

const dateFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

export function BillingPage() {
  const { user, sites } = useWorkspace();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [busy, setBusy] = useState<PlanId | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const chosenCurrency = useCurrency();
  const wanted = useSyncExternalStore(noSubscribe, readWantedPlan, () => null);

  useEffect(() => {
    let live = true;
    apiFetch<Billing>("/billing")
      .then((b) => live && setBilling(b))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Couldn't load billing."));
    return () => {
      live = false;
    };
  }, []);

  if (!billing) {
    return (
      <>
        <PageHeader eyebrow="Workspace" title="Billing" subtitle="Your plan and payments." />
        {error ? <p className="m-10 font-sub text-[14px] text-bad">{error}</p> : <div className="m-10 h-48 animate-pulse rounded-xl bg-white/[0.03]" />}
      </>
    );
  }

  const currency: Currency = billing.usd_enabled ? chosenCurrency : "inr";
  const current = PLANS.find((p) => p.id === billing.plan)!;
  const paid = billing.plan !== "free";
  const status = billing.status ? STATUS[billing.status] : undefined;

  // after checkout the webhook (or our sync) flips the status; check a few times so the page updates by itself
  async function waitForActivation() {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const b = await apiFetch<Billing>("/billing").catch(() => null);
      if (b) setBilling(b);
      if (b?.status === "active") return;
    }
  }

  async function upgrade(plan: PlanId) {
    setError(null);
    setNotice(null);
    setBusy(plan);
    try {
      await loadCheckout();
      const sub = await apiFetch<Subscribe>("/billing/subscribe", { body: { plan, currency } });
      const name = PLANS.find((p) => p.id === plan)!.name;
      const checkout = new window.Razorpay!({
        key: sub.key_id,
        subscription_id: sub.subscription_id,
        name: "Rankwise",
        description: `${name} plan, billed monthly`,
        prefill: sub.prefill,
        theme: { color: "#0f1011" },
        handler: async (response: CheckoutSuccess) => {
          try {
            setBilling(await apiFetch<Billing>("/billing/verify", { body: response }));
            setNotice(`Payment received. Your ${name} plan is being activated.`);
            await waitForActivation();
          } catch (e) {
            setError(e instanceof Error ? e.message : "We couldn't confirm the payment yet. It will update automatically.");
          } finally {
            setBusy(null);
          }
        },
        modal: { ondismiss: () => setBusy(null) },
      });
      checkout.on("payment.failed", (resp) => setError(resp.error?.description || "The payment didn't go through. Nothing was charged."));
      checkout.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start checkout.");
      setBusy(null);
    }
  }

  async function cancel() {
    const ends = billing?.current_end ? dateFmt.format(new Date(billing.current_end)) : "the end of this billing period";
    if (!window.confirm(`Cancel ${current.name}? You'll keep it until ${ends}, then move to Free.`)) return;
    setBusy("cancel");
    setError(null);
    try {
      setBilling(await apiFetch<Billing>("/billing/cancel", { method: "POST" }));
      setNotice(`Cancelled. ${current.name} stays active until ${ends}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't cancel. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const siteCount = sites?.length ?? 0;

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Billing" subtitle={user ? `Signed in as ${user.email}` : "Your plan and payments."} />
      <div className="max-w-[1080px] space-y-6 px-6 py-8 lg:px-10">
        {(error || notice) && (
          <div role={error ? "alert" : "status"} className={`flex gap-3 rounded-lg border px-4 py-3 font-sub text-[13.5px] text-ink-2 ${error ? "border-bad/30 bg-bad-soft" : "border-good/30 bg-good-soft"}`}>
            {error ? <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-bad" /> : <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-good" />}
            <p>{error || notice}</p>
          </div>
        )}

        {/* current plan */}
        <section className="panel flex flex-wrap items-start justify-between gap-6 rounded-xl p-6">
          <div>
            <p className="font-sub text-[13px] text-ink-3">Current plan</p>
            <p className="mt-1 flex items-center gap-3 text-[26px] font-semibold tracking-[-0.03em]">
              {current.name}
              {status && <span className={`rounded-full border border-white/[0.1] px-2.5 py-0.5 font-sub text-[12px] font-normal ${status.tone}`}>{status.label}</span>}
            </p>
            <p className="mt-1 font-sub text-[14px] text-ink-3">
              {paid && billing.current_end
                ? billing.cancel_at_cycle_end
                  ? `Cancelled. Active until ${dateFmt.format(new Date(billing.current_end))}.`
                  : `Renews on ${dateFmt.format(new Date(billing.current_end))} · ${formatPrice(current.price[billing.currency ?? "inr"], billing.currency ?? "inr")} / month`
                : paid
                  ? "Activating…"
                  : "Free forever for one site."}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-10 gap-y-3 font-sub text-[13.5px] sm:grid-cols-3">
            <div>
              <dt className="text-ink-3">Sites</dt>
              <dd className="mt-0.5 tabular-nums">
                {siteCount} / {billing.entitlements.sites}
              </dd>
            </div>
            <div>
              <dt className="text-ink-3">Pageviews / mo</dt>
              <dd className="mt-0.5 tabular-nums">{billing.entitlements.pageviews.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Audits</dt>
              <dd className="mt-0.5 capitalize">{billing.entitlements.audit_cadence}</dd>
            </div>
          </dl>
          {paid && !billing.cancel_at_cycle_end && billing.status === "active" && (
            <button
              type="button"
              onClick={cancel}
              disabled={busy !== null}
              className="w-full cursor-pointer text-left font-sub text-[13px] text-ink-3 underline-offset-4 hover:text-ink hover:underline disabled:cursor-wait sm:w-auto"
            >
              {busy === "cancel" ? "Cancelling…" : "Cancel plan"}
            </button>
          )}
        </section>

        {/* plans */}
        <section aria-labelledby="plans-heading">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 id="plans-heading" className="text-[18px] font-medium tracking-[-0.01em]">
              {paid ? "Plans" : "Upgrade"}
            </h2>
            {billing.usd_enabled && <CurrencyToggle />}
          </div>
          {!billing.payments_enabled && (
            <p className="mt-3 font-sub text-[13.5px] text-ink-3">Payments aren&apos;t switched on yet. You can keep using the Free plan.</p>
          )}
          <ul className="mt-5 grid gap-4 md:grid-cols-2">
            {PLANS.filter((p) => p.id !== "free").map((plan) => {
              const isCurrent = billing.plan === plan.id;
              const highlighted = isPlanId(wanted) ? wanted === plan.id : plan.highlight;
              return (
                <li key={plan.id} className={`flex flex-col rounded-xl p-6 ${highlighted ? "panel border-white/20" : "border border-line"}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-[17px] font-semibold tracking-[-0.02em]">{plan.name}</h3>
                    <p className="font-sub text-[14px] text-ink-3">
                      <span className="font-display text-[26px] font-semibold tracking-[-0.03em] text-ink tabular-nums">{formatPrice(plan.price[currency], currency)}</span> / month
                    </p>
                  </div>
                  <p className="mt-1 text-[14px] text-ink-3">{plan.tagline}</p>
                  <ul className="mt-5 flex-1 space-y-2">
                    {plan.features.slice(0, 5).map((f) => (
                      <li key={f} className="flex gap-2.5 text-[14px] text-ink-2">
                        <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-3" /> {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => upgrade(plan.id)}
                    disabled={isCurrent || paid || busy !== null || !billing.payments_enabled}
                    className={`mt-6 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full font-sub text-[14px] font-medium transition-colors disabled:cursor-not-allowed ${
                      highlighted ? "btn-brand disabled:opacity-50" : "btn-ghost disabled:text-ink-3"
                    }`}
                  >
                    {busy === plan.id && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
                    {isCurrent ? "Current plan" : busy === plan.id ? "Opening checkout…" : `Upgrade to ${plan.name}`}
                  </button>
                  {paid && !isCurrent && <p className="mt-2 font-sub text-[12.5px] text-ink-3">Cancel your current plan to switch.</p>}
                </li>
              );
            })}
          </ul>
          <p className="mt-4 font-sub text-[12.5px] text-ink-3">Payments are processed securely by Razorpay. Plans renew monthly; cancel anytime and keep access until the period ends.</p>
        </section>
      </div>
    </>
  );
}
