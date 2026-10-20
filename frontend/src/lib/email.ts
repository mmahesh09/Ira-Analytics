/**
 * Transactional email for Better Auth (password reset, email verification). Server-only.
 *
 * Off until a provider is configured: EMAIL_PROVIDER=resend with RESEND_API_KEY and EMAIL_FROM (a sender on a
 * domain verified with the provider). EMAIL_PROVIDER=console prints the message to the server log instead, and is
 * refused in production because the message holds a single-use sign-in link.
 */

type Message = { to: string; subject: string; text: string };

const provider = (process.env.EMAIL_PROVIDER ?? "").toLowerCase();
const production = process.env.NODE_ENV === "production";

export const emailEnabled =
  (provider === "resend" && Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)) || (provider === "console" && !production);

export async function sendEmail({ to, subject, text }: Message): Promise<void> {
  if (provider === "console" && !production) {
    console.info(`[email:console] to=${to} subject=${subject}\n${text}`);
    return;
  }
  if (provider !== "resend") throw new Error("Email is not configured (set EMAIL_PROVIDER).");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
    signal: AbortSignal.timeout(10_000),
  });
  // status only: the response body can echo the recipient and the message
  if (!res.ok) throw new Error(`Email provider refused the message (HTTP ${res.status}).`);
}
