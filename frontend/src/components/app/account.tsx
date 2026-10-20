"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { CircleAlert, CircleCheck, ShieldCheck } from "lucide-react";
import { PageHeader } from "./workspace";
import { authClient } from "@/lib/auth-client";

type AuthError = { status: number; code?: string; message?: string };
const offline = () => ({ data: null, error: { status: 0 } as AuthError });

const inputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 text-[14px] text-ink outline-none focus-visible:border-white/25";
const primary = "inline-flex h-9 cursor-pointer items-center rounded-lg btn-brand px-3.5 font-sub text-[13.5px] font-medium disabled:cursor-not-allowed disabled:opacity-60";
const ghost = "btn-ghost inline-flex h-9 cursor-pointer items-center rounded-lg px-3.5 font-sub text-[13.5px]";

function explain(error: AuthError, fallback: string): string {
  if (error.status === 429) return "Too many attempts. Wait a few minutes, then try again.";
  if (error.status === 0 || error.status >= 500) return "We can't reach the account service right now. Please try again in a moment.";
  if (error.code === "INVALID_PASSWORD") return "That password isn't right.";
  if (error.code === "PASSWORD_COMPROMISED") return "This password appeared in a data breach, so it's easy to guess. Choose a different one.";
  if (error.code === "PASSWORD_TOO_SHORT") return "Use at least 8 characters for your new password.";
  if (error.code === "INVALID_CODE" || error.code === "INVALID_TWO_FACTOR_AUTHENTICATION") return "That code didn't match. Codes change every 30 seconds; try the current one.";
  return error.message || fallback;
}

function Section({ id, title, intro, children }: { id: string; title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-line p-6">
      <h2 id={id} className="text-[18px] font-medium tracking-[-0.01em]">
        {title}
      </h2>
      <p className="mt-1 max-w-[70ch] font-sub text-[13.5px] text-ink-3">{intro}</p>
      {children}
    </section>
  );
}

function Message({ kind, children }: { kind: "error" | "ok"; children: ReactNode }) {
  const Icon = kind === "error" ? CircleAlert : CircleCheck;
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`mt-3 flex items-start gap-2 font-sub text-[13px] ${kind === "error" ? "text-bad" : "text-good"}`}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {children}
    </p>
  );
}

function ChangePassword() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setResult(null);
    const { error } = await authClient
      .changePassword({ currentPassword: String(values.get("current")), newPassword: String(values.get("next")), revokeOtherSessions: true })
      .catch(offline);
    setBusy(false);
    if (error) return setResult({ kind: "error", text: explain(error, "Couldn't change the password. Please try again.") });
    form.reset();
    setResult({ kind: "ok", text: "Password changed. Other devices have been signed out." });
  }

  return (
    <Section id="password-heading" title="Password" intro="Changing it signs you out on every other device.">
      <form onSubmit={submit} className="mt-4 grid max-w-[420px] gap-3">
        <label className="font-sub text-[13px] text-ink-2">
          Current password
          <input name="current" type="password" required autoComplete="current-password" className={inputClass} />
        </label>
        <label className="font-sub text-[13px] text-ink-2">
          New password
          <input name="next" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} />
        </label>
        {result && <Message kind={result.kind}>{result.text}</Message>}
        <div>
          <button type="submit" disabled={busy} className={primary}>
            {busy ? "Saving…" : "Change password"}
          </button>
        </div>
      </form>
    </Section>
  );
}

type Setup = { secret: string; uri: string; backupCodes: string[] };

function TwoFactor({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  const [step, setStep] = useState<"idle" | "password" | "scan" | "disable">("idle");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const password = String(new FormData(event.currentTarget).get("password"));
    const { data, error: failed } = await authClient.twoFactor.enable({ password, issuer: "Rankwise" }).catch(offline);
    setBusy(false);
    if (failed || !data || !("totpURI" in data)) return setError(explain(failed ?? { status: 0 }, "Couldn't start the setup. Please try again."));
    const secret = new URL(data.totpURI).searchParams.get("secret") ?? "";
    setSetup({ secret, uri: data.totpURI, backupCodes: data.backupCodes });
    setStep("scan");
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const code = String(new FormData(event.currentTarget).get("code")).replace(/\s/g, "");
    const { error: failed } = await authClient.twoFactor.verifyTotp({ code }).catch(offline);
    setBusy(false);
    if (failed) return setError(explain(failed, "That code didn't match. Try the current one."));
    setStep("idle");
    onChange();
  }

  async function disable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const password = String(new FormData(event.currentTarget).get("password"));
    const { error: failed } = await authClient.twoFactor.disable({ password }).catch(offline);
    setBusy(false);
    if (failed) return setError(explain(failed, "Couldn't turn it off. Please try again."));
    setStep("idle");
    setSetup(null);
    onChange();
  }

  const cancel = () => {
    setStep("idle");
    setError(null);
  };

  return (
    <Section
      id="mfa-heading"
      title="Two-step verification"
      intro="After your password, sign-in also asks for a 6-digit code from an authenticator app (Google Authenticator, 1Password, Authy…)."
    >
      {enabled && step === "idle" && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-good/25 bg-good-soft px-3 py-1 font-sub text-[12.5px] text-ink-2">
          <ShieldCheck aria-hidden="true" className="size-4 text-good" /> On for this account
        </p>
      )}

      {step === "idle" && (
        <div className="mt-4">
          <button type="button" onClick={() => setStep(enabled ? "disable" : "password")} className={enabled ? ghost : primary}>
            {enabled ? "Turn off" : "Turn on"}
          </button>
        </div>
      )}

      {(step === "password" || step === "disable") && (
        <form onSubmit={step === "password" ? start : disable} className="mt-4 grid max-w-[420px] gap-3">
          <label className="font-sub text-[13px] text-ink-2">
            Confirm your password
            <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
          </label>
          {error && <Message kind="error">{error}</Message>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={primary}>
              {busy ? "Checking…" : step === "password" ? "Continue" : "Turn off two-step verification"}
            </button>
            <button type="button" onClick={cancel} className={ghost}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {step === "scan" && setup && (
        <div className="mt-4 grid max-w-[520px] gap-5">
          <div>
            <p className="font-sub text-[13.5px] text-ink-2">
              1. In your authenticator app, add an account with this setup key (or{" "}
              <a href={setup.uri} className="text-ink underline underline-offset-4">
                open it in the app
              </a>{" "}
              on this device):
            </p>
            <code className="mt-2 block break-all rounded-lg border border-line bg-white/[0.03] px-3 py-2 font-mono text-[14px] tracking-[0.12em] text-ink">
              {setup.secret.match(/.{1,4}/g)?.join(" ")}
            </code>
          </div>
          <div>
            <p className="font-sub text-[13.5px] text-ink-2">2. Save these backup codes somewhere safe. Each one signs you in once if you lose your phone.</p>
            <ul className="mt-2 grid grid-cols-2 gap-1.5 rounded-lg border border-line bg-white/[0.03] p-3 font-mono text-[13.5px] text-ink">
              {setup.backupCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          <form onSubmit={confirm} className="grid gap-3">
            <label className="font-sub text-[13px] text-ink-2">
              3. Enter the 6-digit code the app shows
              <input name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} className={`${inputClass} font-mono tracking-[0.2em]`} />
            </label>
            {error && <Message kind="error">{error}</Message>}
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={primary}>
                {busy ? "Checking…" : "Turn on"}
              </button>
              <button type="button" onClick={cancel} className={ghost}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </Section>
  );
}

function Sessions() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function revoke() {
    setState("busy");
    const { error } = await authClient.revokeOtherSessions().catch(offline);
    setState(error ? "error" : "done");
  }

  return (
    <Section id="sessions-heading" title="Signed-in devices" intro="Lost a laptop or used a shared computer? Sign out everywhere except here.">
      <div className="mt-4">
        <button type="button" onClick={revoke} disabled={state === "busy"} className={ghost}>
          {state === "busy" ? "Signing out…" : "Sign out other devices"}
        </button>
      </div>
      {state === "done" && <Message kind="ok">Every other session has been signed out.</Message>}
      {state === "error" && <Message kind="error">Couldn&apos;t sign out other devices. Please try again.</Message>}
    </Section>
  );
}

export function AccountPage() {
  const { data: session, refetch } = authClient.useSession();
  const enabled = Boolean((session?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled);

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Account & security" subtitle={session ? `Signed in as ${session.user.email}` : "Password, two-step verification and devices."} />
      <div className="max-w-[1080px] space-y-6 px-6 py-8 lg:px-10">
        <ChangePassword />
        <TwoFactor enabled={enabled} onChange={() => refetch()} />
        <Sessions />
      </div>
    </>
  );
}
