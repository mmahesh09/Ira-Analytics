"use client";

import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Check, CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { AUDIT_COST, DEEP_AUDIT_COST, PACKS, PLANS, formatPrice, isPlanId, type Currency, type PlanId } from "@/lib/plans";
import type { Billing, PaymentRow } from "@/lib/types";
import { CurrencyToggle, useCurrency } from "@/components/pricing/currency";
import { PageHeader, useWorkspace } from "./workspace";
import posthog from "posthog-js";

const posthogEnabled = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST);

type Subscribe = { subscription_id: string; key_id: string; plan: PlanId; currency: Currency; prefill: Record<string, string> };
type CheckoutSuccess = { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string };
type PackOrder = { order_id: string; key_id: string; amount: number; currency: Currency; credits: number; prefill: Record<string, string> };
type PackSuccess = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
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
  const [busy, setBusy] = useState<string | null>(null);
  const [history, setHistory] = useState<PaymentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const chosenCurrency = useCurrency();
  const wanted = useSyncExternalStore(noSubscribe, readWantedPlan, () => null);

  useEffect(() => {
    let live = true;
    apiFetch<Billing>("/billing")
      .then((b) => live && setBilling(b))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Couldn't load billing."));
    apiFetch<PaymentRow[]>("/billing/payments")
      .then((p) => live && setHistory(p))
      .catch(() => live && setHistory([]));
    return () => {
      live = false;
    };
  }, []);

  const reloadHistory = () => apiFetch<PaymentRow[]>("/billing/payments").then(setHistory).catch(() => {});

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

  /** On a paid plan: upgrade now (extra credits added at once) or downgrade at the end of the period. */
  async function changePlan(plan: PlanId) {
    const target = PLANS.find((p) => p.id === plan)!;
    const up = PLANS.findIndex((p) => p.id === plan) > PLANS.findIndex((p) => p.id === billing!.plan);
    const ends = billing?.current_end ? dateFmt.format(new Date(billing.current_end)) : "the end of this period";
    const message = up
      ? `Upgrade to ${target.name} now? Razorpay adjusts this month's charge, and the extra audit credits are added straight away.`
      : `Switch to ${target.name} on ${ends}? You keep ${current.name} and its credits until then.`;
    if (!window.confirm(message)) return;
    setError(null);
    setNotice(null);
    setBusy(plan);
    try {
      setBilling(await apiFetch<Billing>("/billing/change-plan", { body: { plan } }));
      if (posthogEnabled) posthog.capture("plan_changed", { plan, change_type: up ? "upgrade" : "downgrade" });
      setNotice(up ? `You're on ${target.name}. The extra credits are in your balance.` : `Done. You'll move to ${target.name} on ${ends}.`);
      reloadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change plan. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function buyPack(packId: string) {
    setError(null);
    setNotice(null);
    setBusy(packId);
    try {
      await loadCheckout();
      const order = await apiFetch<PackOrder>(`/billing/packs/${packId}/order`, { body: { currency } });
      const checkout = new window.Razorpay!({
        key: order.key_id,
        order_id: order.order_id,
        amount: order.amount,
        currency: order.currency.toUpperCase(),
        name: "Rankwise",
        description: `${order.credits} audit credits (valid 12 months)`,
        prefill: order.prefill,
        theme: { color: "#0f1011" },
        handler: async (response: PackSuccess) => {
          try {
            setBilling(await apiFetch<Billing>("/billing/packs/verify", { body: response }));
            if (posthogEnabled) posthog.capture("credit_pack_purchased", { pack_id: packId, credits: order.credits, currency: order.currency });
            setNotice(`${order.credits} audit credits added. They're used after your monthly credits and last 12 months.`);
            reloadHistory();
          } catch (e) {
            setError(e instanceof Error ? e.message : "We couldn't confirm the payment yet. The credits will appear automatically.");
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

  async function upgrade(plan: PlanId) {
    if (paid) return changePlan(plan);
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
            if (posthogEnabled) posthog.capture("subscription_started", { plan, currency: sub.currency });
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
      if (posthogEnabled) posthog.capture("subscription_cancelled", { plan: billing?.plan });
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
              {billing.scheduled_plan && billing.current_end && !billing.cancel_at_cycle_end && (
                <span className="block">
                  Switching to {PLANS.find((p) => p.id === billing.scheduled_plan)?.name} on {dateFmt.format(new Date(billing.current_end))}.
                </span>
              )}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-10 gap-y-3 font-sub text-[13.5px] sm:grid-cols-3">
            <div>
              <dt className="text-ink-3">Websites</dt>
              <dd className="mt-0.5 tabular-nums">
                {siteCount} / {billing.entitlements.sites}
              </dd>
            </div>
            <div>
              <dt className="text-ink-3">Audit credits left</dt>
              <dd className="mt-0.5 tabular-nums">{billing.credits.total}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Light checks today</dt>
              <dd className="mt-0.5 tabular-nums">
                {billing.checks_today} / {billing.entitlements.daily_checks}
              </dd>
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

        {/* credits */}
        <section aria-labelledby="credits-heading" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="rounded-xl border border-line p-6">
            <h2 id="credits-heading" className="text-[18px] font-medium tracking-[-0.01em]">
              Audit credits
            </h2>
            <p className="mt-1 font-sub text-[13.5px] text-ink-3">
              {AUDIT_COST} credit per full audit{billing.entitlements.deep_audit ? `, ${DEEP_AUDIT_COST} per deep audit` : ""}. Light checks and opening reports are free.
            </p>
            <dl className="mt-5 space-y-2.5 font-sub text-[14px]">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-2">This month&rsquo;s credits</dt>
                <dd className="tabular-nums">
                  {billing.credits.monthly} of {billing.entitlements.monthly_credits}
                </dd>
              </div>
              {billing.credits.pack > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-2">Credit packs</dt>
                  <dd className="tabular-nums">{billing.credits.pack}</dd>
                </div>
              )}
              {billing.credits.adjustment > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-2">Refunded credits</dt>
                  <dd className="tabular-nums">{billing.credits.adjustment}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-line pt-2.5 font-medium">
                <dt>Available now</dt>
                <dd className="tabular-nums">{billing.credits.total}</dd>
              </div>
            </dl>
            {billing.credits.monthly_expires_at && (
              <p className="mt-3 font-sub text-[12.5px] text-ink-3">
                Monthly credits reset on {dateFmt.format(new Date(billing.credits.monthly_expires_at))} and don&rsquo;t roll over.
              </p>
            )}
            {billing.entitlements.credit_packs && (
              <div className="mt-5 border-t border-line pt-5">
                <p className="font-sub text-[13.5px] text-ink-2">Need more audits this month?</p>
                <ul className="mt-3 grid grid-cols-2 gap-2">
                  {PACKS.map((pack) => (
                    <li key={pack.id}>
                      <button
                        type="button"
                        onClick={() => buyPack(pack.id)}
                        disabled={!billing.payments_enabled || busy !== null}
                        className="btn-ghost inline-flex w-full cursor-pointer flex-col items-start rounded-lg px-3.5 py-2.5 text-left disabled:cursor-not-allowed disabled:text-ink-3"
                      >
                        <span className="font-sub text-[14px] font-medium">{pack.credits} credits</span>
                        <span className="font-sub text-[12.5px] tabular-nums">{formatPrice(pack.price[currency], currency)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-sub text-[12.5px] text-ink-3">
                  {billing.payments_enabled
                    ? "One-time purchase. Used after your monthly credits, valid 12 months; refundable within 7 days if unused."
                    : "Credit packs go on sale when payments are switched on."}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-line p-6">
            <h2 className="text-[18px] font-medium tracking-[-0.01em]">Recent usage</h2>
            {billing.usage.length === 0 ? (
              <p className="mt-3 font-sub text-[13.5px] text-ink-3">No full audits yet. Run one from any website&rsquo;s overview.</p>
            ) : (
              <table className="mt-4 w-full font-sub text-[13.5px]">
                <caption className="sr-only">Credits used by recent audits</caption>
                <thead>
                  <tr className="text-left text-[12px] text-ink-3">
                    <th scope="col" className="pb-2 font-normal">Website</th>
                    <th scope="col" className="pb-2 font-normal">Audit</th>
                    <th scope="col" className="pb-2 font-normal">When</th>
                    <th scope="col" className="pb-2 text-right font-normal">Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {billing.usage.map((row, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="max-w-[12rem] truncate py-2.5 pr-3">{row.site ?? "Deleted website"}</td>
                      <td className="py-2.5 pr-3 text-ink-2">{row.kind === "deep_audit" ? "Deep" : "Full"}</td>
                      <td className="py-2.5 pr-3 text-ink-3">{dateFmt.format(new Date(row.created_at))}</td>
                      <td className="py-2.5 text-right tabular-nums">
                        {row.status === "released" ? (
                          <span className="text-ink-3">Refunded</span>
                        ) : row.status === "held" ? (
                          <span className="text-ink-3">Running · {row.cost}</span>
                        ) : (
                          <span>&minus;{row.cost}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
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
          <ul className="mt-5 grid gap-4 md:grid-cols-3">
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
                  <p className="mt-4 font-sub text-[13.5px] text-ink-2">
                    <span className="font-medium text-ink tabular-nums">{plan.credits}</span> audit credits / mo ·{" "}
                    <span className="font-medium text-ink tabular-nums">{plan.sites}</span> websites
                  </p>
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
                    disabled={isCurrent || busy !== null || !billing.payments_enabled || (paid && billing.status !== "active") || billing.scheduled_plan === plan.id}
                    className={`mt-6 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full font-sub text-[14px] font-medium transition-colors disabled:cursor-not-allowed ${
                      highlighted ? "btn-brand disabled:opacity-50" : "btn-ghost disabled:text-ink-3"
                    }`}
                  >
                    {busy === plan.id && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
                    {isCurrent
                      ? "Current plan"
                      : billing.scheduled_plan === plan.id
                        ? "Starts next period"
                        : busy === plan.id
                          ? paid
                            ? "Switching…"
                            : "Opening checkout…"
                          : paid && PLANS.findIndex((p) => p.id === plan.id) < PLANS.findIndex((p) => p.id === billing.plan)
                            ? `Switch to ${plan.name}`
                            : `Upgrade to ${plan.name}`}
                  </button>
                  {paid && !isCurrent && billing.scheduled_plan !== plan.id && (
                    <p className="mt-2 font-sub text-[12.5px] text-ink-3">
                      {PLANS.findIndex((p) => p.id === plan.id) > PLANS.findIndex((p) => p.id === billing.plan) ? "Starts now; extra credits added at once." : "Takes effect when this period ends."}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-4 font-sub text-[12.5px] text-ink-3">
            Payments are processed securely by Razorpay. Plans renew monthly. No refunds; cancel anytime and keep access until the period ends.
          </p>
        </section>

        {/* payment history */}
        <section aria-labelledby="payments-heading" className="rounded-xl border border-line p-6">
          <h2 id="payments-heading" className="text-[18px] font-medium tracking-[-0.01em]">
            Payment history
          </h2>
          {history === null ? (
            <div className="mt-4 h-16 animate-pulse rounded-lg bg-white/[0.03]" />
          ) : history.length === 0 ? (
            <p className="mt-2 font-sub text-[13.5px] text-ink-3">No payments yet.</p>
          ) : (
            <table className="mt-4 w-full font-sub text-[13.5px]">
              <caption className="sr-only">Your payments</caption>
              <thead>
                <tr className="text-left text-[12px] text-ink-3">
                  <th scope="col" className="pb-2 font-normal">Date</th>
                  <th scope="col" className="pb-2 font-normal">Description</th>
                  <th scope="col" className="pb-2 font-normal">Status</th>
                  <th scope="col" className="pb-2 text-right font-normal">Amount</th>
                </tr>
              </thead>
              <tbody>
                {history.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="py-2.5 pr-3 text-ink-3">{p.paid_at ? dateFmt.format(new Date(p.paid_at)) : "—"}</td>
                    <td className="py-2.5 pr-3">{p.description ?? (p.kind === "pack" ? "Credit pack" : "Subscription")}</td>
                    <td className={`py-2.5 pr-3 capitalize ${p.status === "captured" ? "text-good" : p.status === "failed" ? "text-bad" : "text-ink-3"}`}>
                      {p.status === "captured" ? "Paid" : p.status}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{formatPrice(p.amount / 100, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <DeleteAccount paidAndRenewing={paid && billing.status !== "cancelled" && !billing.cancel_at_cycle_end} />
      </div>
    </>
  );
}

/** Self-serve account deletion: re-enter the password and type DELETE. The server refuses while a plan renews. */
function DeleteAccount({ paidAndRenewing }: { paidAndRenewing: boolean }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: failed } = await authClient.deleteUser({ password });
    if (failed) {
      setError(failed.message || "Couldn't delete the account. Check your password and try again.");
      setBusy(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <section aria-labelledby="delete-heading" className="rounded-xl border border-bad/25 p-6">
      <h2 id="delete-heading" className="text-[18px] font-medium tracking-[-0.01em]">
        Delete account
      </h2>
      <p className="mt-1 max-w-[70ch] font-sub text-[13.5px] text-ink-3">
        Permanently deletes your account, websites, reports, credits and billing history from Rankwise. This can&rsquo;t be undone.
        {paidAndRenewing && " Cancel your paid plan first, so you aren't charged again."}
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={paidAndRenewing}
          className="mt-4 inline-flex h-9 cursor-pointer items-center rounded-lg border border-bad/40 px-3.5 font-sub text-[13.5px] text-bad transition-colors hover:bg-bad-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete my account
        </button>
      ) : (
        <form onSubmit={remove} className="mt-4 grid max-w-[420px] gap-3">
          <label className="font-sub text-[13px] text-ink-2">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 text-[14px] text-ink outline-none focus-visible:border-white/25"
            />
          </label>
          <label className="font-sub text-[13px] text-ink-2">
            Type DELETE to confirm
            <input
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 text-[14px] text-ink outline-none focus-visible:border-white/25"
            />
          </label>
          {error && (
            <p role="alert" className="font-sub text-[13px] text-bad">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || confirm !== "DELETE" || !password}
              className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-bad px-3.5 font-sub text-[13.5px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost inline-flex h-9 cursor-pointer items-center rounded-lg px-3.5 font-sub text-[13.5px]">
              Keep my account
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
