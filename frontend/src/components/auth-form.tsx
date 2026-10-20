"use client";

import { useId, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleAlert, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { PLANS, isPlanId } from "@/lib/plans";

// ?plan= from the pricing CTAs; read client-side only so the page still prerenders
const noSubscribe = () => () => {};
const readPlan = () => new URLSearchParams(window.location.search).get("plan");

type Problem = { message: ReactNode; field?: "email" | "password" };

/** Turns a Better Auth error into something a person can act on. */
function describe(error: { code?: string; status: number; message?: string }, signup: boolean): Problem {
  const code = error.code ?? "";
  // the per-account lockout explains itself; the per-IP limit gets the generic message
  if (error.status === 429) return { message: error.message?.startsWith("Too many failed") ? error.message : "Too many attempts. Wait a minute, then try again." };
  if (code === "PASSWORD_COMPROMISED") return { field: "password", message: "This password appeared in a data breach, so it's easy to guess. Choose a different one." };
  if (error.status >= 500 || error.status === 0)
    return { message: "We can't reach the account service right now. Your details are fine; please try again in a moment." };
  if (code.startsWith("USER_ALREADY_EXISTS"))
    return {
      field: "email",
      message: (
        <>
          An account with this email already exists.{" "}
          <Link href="/login" className="font-medium text-ink underline underline-offset-4">
            Log in instead
          </Link>
        </>
      ),
    };
  if (code === "INVALID_EMAIL_OR_PASSWORD") return { field: "password", message: "That email and password don't match. Check both and try again." };
  if (code === "INVALID_EMAIL") return { field: "email", message: "That doesn't look like a valid email address." };
  if (code === "PASSWORD_TOO_SHORT") return { field: "password", message: "Use at least 8 characters for your password." };
  if (code === "PASSWORD_TOO_LONG") return { field: "password", message: "That password is too long. Use 128 characters or fewer." };
  return { message: error.message || (signup ? "We couldn't create your account. Please try again." : "We couldn't sign you in. Please try again.") };
}

export const fieldClass =
  "h-11 w-full rounded-lg border bg-white/[0.03] px-3.5 font-sub text-[15px] text-ink outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-ink-3/70 hover:border-white/[0.16] focus-visible:border-white/30 focus-visible:bg-white/[0.04] focus-visible:shadow-[0_0_0_4px_rgb(255_255_255/0.06)] focus-visible:outline-none";

export function Field({ label, hint, invalid, children }: { label: string; hint?: ReactNode; invalid?: boolean; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="font-sub text-[13px] font-medium text-ink-2">
        {label}
      </label>
      <div className="mt-2">{children(id, hintId)}</div>
      {hint && (
        <p id={hintId} className={`mt-2 font-sub text-[12.5px] ${invalid ? "text-bad" : "text-ink-3"}`}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const signup = mode === "signup";
  const [problem, setProblem] = useState<Problem | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [verifySent, setVerifySent] = useState<string | null>(null);
  const planParam = useSyncExternalStore(noSubscribe, readPlan, () => null);
  const plan = signup && isPlanId(planParam) && planParam !== "free" ? PLANS.find((p) => p.id === planParam) : undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const name = String(form.get("name") ?? "").trim();
    setProblem(null);
    setPending(true);
    try {
      const { data, error } = signup
        ? await authClient.signUp.email({ email, password, name: name || email.split("@")[0] })
        : await authClient.signIn.email({ email, password });
      if (error) {
        setProblem(describe(error, signup));
        setPending(false);
        return;
      }
      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
        // password was right; the authenticator code finishes the sign-in (keeps ?next=)
        router.push(`/two-factor${window.location.search}`);
        return;
      }
      if (signup && data && "token" in data && !data.token) {
        // email verification is required: no session until the link in the email is opened
        setVerifySent(email);
        setPending(false);
        return;
      }
      if (plan) {
        try {
          localStorage.setItem("rw_intended_plan", plan.id); // picked up when billing launches
        } catch {}
      }
      // read at submit time (not useSearchParams) so the page prerenders fully
      const next = new URLSearchParams(window.location.search).get("next");
      // picked a paid plan on the pricing page: finish the upgrade right after sign-up
      router.replace(plan ? `/app/billing?plan=${plan.id}` : next?.startsWith("/app") ? next : "/app");
      router.refresh();
    } catch {
      setProblem(describe({ status: 0 }, signup));
      setPending(false);
    }
  }

  const passwordInvalid = problem?.field === "password";
  const emailInvalid = problem?.field === "email";
  const border = (bad: boolean) => (bad ? "border-bad/60" : "border-white/[0.1]");

  if (verifySent) {
    return (
      <div data-enter="" style={{ ["--y" as string]: "12px" }}>
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.025em]">Check your inbox</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-3">
          If {verifySent} can be used for a new account, we&apos;ve sent it a link to confirm the address. Open it to finish signing up.
        </p>
        <Link href="/login" className="mt-8 inline-block font-sub text-[14px] font-medium text-ink underline-offset-4 hover:underline">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <div data-enter="" style={{ ["--y" as string]: "12px" }}>
      <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.025em]">{signup ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-3">
        {signup ? "Start tracking traffic, rankings and AI visibility. Free, no card needed." : "Log in to see your sites, audits and AI visibility."}
      </p>
      {plan && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] px-3 py-1 font-sub text-[12.5px] text-ink-2">
          You picked {plan.name}. Create your account, then confirm payment on the next screen.
        </p>
      )}

      {problem && (
        <div role="alert" className="mt-8 flex gap-3 rounded-lg border border-bad/30 bg-bad-soft px-4 py-3 font-sub text-[13.5px] leading-relaxed text-ink-2">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-bad" />
          <p>{problem.message}</p>
        </div>
      )}

      <form onSubmit={submit} className={`${problem ? "mt-6" : "mt-8"} space-y-5`}>
        {signup && (
          <Field label="Full name">
            {(id) => <input id={id} name="name" autoComplete="name" placeholder="Ada Lovelace" maxLength={120} className={`${fieldClass} ${border(false)}`} />}
          </Field>
        )}
        <Field label="Work email">
          {(id) => (
            <input
              id={id}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              placeholder="you@company.com"
              aria-invalid={emailInvalid || undefined}
              className={`${fieldClass} ${border(emailInvalid)}`}
            />
          )}
        </Field>
        <Field
          label="Password"
          invalid={signup && password.length > 0 && password.length < 8}
          hint={signup ? (password.length > 0 && password.length < 8 ? `${8 - password.length} more character${8 - password.length === 1 ? "" : "s"} needed` : "At least 8 characters") : undefined}
        >
          {(id, describedBy) => (
            <div className="relative">
              <input
                id={id}
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={signup ? "new-password" : "current-password"}
                required
                minLength={signup ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby={describedBy}
                aria-invalid={passwordInvalid || undefined}
                className={`${fieldClass} ${border(passwordInvalid)} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 grid w-11 cursor-pointer place-items-center rounded-r-lg text-ink-3 transition-colors hover:text-ink"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          )}
        </Field>
        {!signup && (
          <p className="-mt-2 text-right font-sub text-[13px]">
            <Link href="/forgot-password" className="text-ink-3 underline-offset-4 hover:text-ink hover:underline">
              Forgot password?
            </Link>
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 flex h-11 w-full cursor-pointer items-center justify-center gap-2 btn-brand rounded-full font-sub text-[14.5px] font-medium disabled:cursor-wait disabled:opacity-80"
        >
          {pending ? (
            <>
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> {signup ? "Creating your account…" : "Logging in…"}
            </>
          ) : (
            <>
              {signup ? "Create account" : "Log in"} <ArrowRight aria-hidden="true" className="size-4" />
            </>
          )}
        </button>
      </form>

      <p className="mt-8 font-sub text-[14px] text-ink-3">
        {signup ? "Already have an account? " : "New to Rankwise? "}
        <Link href={signup ? "/login" : "/signup"} className="font-medium text-ink underline-offset-4 hover:underline">
          {signup ? "Log in" : "Create an account"}
        </Link>
      </p>
      {signup && <p className="mt-10 border-t border-line pt-6 text-[12.5px] leading-relaxed text-ink-3">We never store IP addresses or set tracking cookies on your visitors.</p>}
    </div>
  );
}
