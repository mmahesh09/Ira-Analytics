"use client";

import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleAlert, LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Field, fieldClass } from "@/components/auth-form";

type AuthError = { status: number; code?: string; message?: string };

// query values are read client-side only, so the pages still prerender
const noSubscribe = () => () => {};
const readParam = (name: string) => () => new URLSearchParams(window.location.search).get(name);
const useParam = (name: string) => useSyncExternalStore(noSubscribe, readParam(name), () => null);
const offline = () => ({ error: { status: 0 } as AuthError });

function Heading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.025em]">{title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-3">{children}</p>
    </>
  );
}

function Problem({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="mt-6 flex gap-3 rounded-lg border border-bad/30 bg-bad-soft px-4 py-3 font-sub text-[13.5px] leading-relaxed text-ink-2">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-bad" />
      <p>{message}</p>
    </div>
  );
}

function Submit({ pending, idle, busy }: { pending: boolean; idle: string; busy: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 flex h-11 w-full cursor-pointer items-center justify-center gap-2 btn-brand rounded-full font-sub text-[14.5px] font-medium disabled:cursor-wait disabled:opacity-80"
    >
      {pending ? (
        <>
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> {busy}
        </>
      ) : (
        <>
          {idle} <ArrowRight aria-hidden="true" className="size-4" />
        </>
      )}
    </button>
  );
}

const input = `${fieldClass} border-white/[0.1]`;

function friendly(error: AuthError, fallback: string): string {
  if (error.status === 429) return "Too many attempts. Wait a few minutes, then try again.";
  if (error.status === 0 || error.status >= 500) return "We can't reach the account service right now. Please try again in a moment.";
  if (error.code === "PASSWORD_COMPROMISED") return "This password appeared in a data breach, so it's easy to guess. Choose a different one.";
  if (error.code === "PASSWORD_TOO_SHORT") return "Use at least 8 characters for your password.";
  return error.message || fallback;
}

/** Asks for a reset link. Always reports the same outcome, so it can't be used to test which emails have accounts. */
export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setPending(true);
    setProblem(null);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" }).catch(offline);
    setPending(false);
    if (error) {
      // a 400 mentioning "enabled" means no email provider is set up on the server yet
      setProblem(
        error.status === 400 && /enabled/i.test(error.message ?? "")
          ? "Password reset by email isn't available yet. Contact support and we'll help you get back in."
          : friendly(error, "We couldn't send the link. Please try again."),
      );
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div data-enter="">
        <Heading title="Check your inbox">If an account uses that email, a link to reset the password is on its way. It works once, for 30 minutes.</Heading>
        <Link href="/login" className="mt-8 inline-block font-sub text-[14px] font-medium text-ink underline-offset-4 hover:underline">
          Back to log in
        </Link>
      </div>
    );
  }
  return (
    <div data-enter="">
      <Heading title="Reset your password">Enter the email you use for Rankwise and we&apos;ll send you a reset link.</Heading>
      <Problem message={problem} />
      <form onSubmit={submit} className="mt-8 space-y-5">
        <Field label="Work email">{(id) => <input id={id} name="email" type="email" autoComplete="email" required className={input} />}</Field>
        <Submit pending={pending} idle="Send reset link" busy="Sending…" />
      </form>
      <p className="mt-8 font-sub text-[14px] text-ink-3">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-ink underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

/** Lands here from the email link (?token=…). A used or expired link arrives as ?error=INVALID_TOKEN. */
export function ResetPasswordForm() {
  const router = useRouter();
  const token = useParam("token");
  const linkError = useParam("error");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setPending(true);
    setProblem(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token }).catch(offline);
    if (error) {
      setPending(false);
      setProblem(error.code === "INVALID_TOKEN" ? "This link has expired or was already used. Ask for a new one." : friendly(error, "We couldn't change the password. Please try again."));
      return;
    }
    router.replace("/login"); // the reset also signed out every other session
  }

  if (linkError || !token) {
    return (
      <div data-enter="">
        <Heading title="This link doesn't work">Reset links work once, for 30 minutes. Ask for a new one and use the latest email.</Heading>
        <Link href="/forgot-password" className="mt-8 inline-block font-sub text-[14px] font-medium text-ink underline-offset-4 hover:underline">
          Send a new link
        </Link>
      </div>
    );
  }
  return (
    <div data-enter="">
      <Heading title="Choose a new password">You&apos;ll be signed out everywhere else once it&apos;s changed.</Heading>
      <Problem message={problem} />
      <form onSubmit={submit} className="mt-8 space-y-5">
        <Field label="New password" hint="At least 8 characters">
          {(id, describedBy) => (
            <input id={id} type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby={describedBy} className={input} />
          )}
        </Field>
        <Submit pending={pending} idle="Change password" busy="Saving…" />
      </form>
    </div>
  );
}

/** Second step of sign-in for accounts with two-factor on: a 6-digit authenticator code, or a backup code. */
export function TwoFactorForm() {
  const router = useRouter();
  const [backup, setBackup] = useState(false);
  const [trust, setTrust] = useState(false);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    setPending(true);
    setProblem(null);
    const verify = backup ? authClient.twoFactor.verifyBackupCode({ code, trustDevice: trust }) : authClient.twoFactor.verifyTotp({ code, trustDevice: trust });
    const { error } = await verify.catch(offline);
    if (error) {
      setPending(false);
      setProblem(error.status === 401 ? "Your sign-in timed out or the code didn't match. Check the code, or log in again." : friendly(error, "That code didn't work. Check it and try again."));
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(next?.startsWith("/app") ? next : "/app");
    router.refresh();
  }

  return (
    <div data-enter="">
      <Heading title="Two-step verification">
        {backup ? "Enter one of the backup codes you saved when you turned on two-step verification. Each works once." : "Enter the 6-digit code from your authenticator app."}
      </Heading>
      <Problem message={problem} />
      <form onSubmit={submit} className="mt-8 space-y-5">
        <Field label={backup ? "Backup code" : "Authentication code"}>
          {(id) => (
            <input
              key={backup ? "backup" : "totp"}
              id={id}
              name="code"
              required
              autoComplete="one-time-code"
              inputMode={backup ? "text" : "numeric"}
              pattern={backup ? undefined : "[0-9 ]{6,7}"}
              maxLength={backup ? 32 : 7}
              className={`${input} font-mono tracking-[0.2em]`}
            />
          )}
        </Field>
        <label className="flex items-center gap-2 font-sub text-[13.5px] text-ink-2">
          <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} className="size-4" />
          Trust this device for 30 days
        </label>
        <Submit pending={pending} idle="Verify" busy="Checking…" />
      </form>
      <p className="mt-8 font-sub text-[14px] text-ink-3">
        <button type="button" onClick={() => setBackup((b) => !b)} className="cursor-pointer font-medium text-ink underline-offset-4 hover:underline">
          {backup ? "Use my authenticator app" : "Use a backup code instead"}
        </button>
      </p>
    </div>
  );
}
