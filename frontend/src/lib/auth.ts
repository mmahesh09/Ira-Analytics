import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { haveIBeenPwned, twoFactor } from "better-auth/plugins";
import { attachDatabasePool } from "@vercel/functions";
import { after } from "next/server";
import { Pool } from "pg";
import { emailEnabled, sendEmail } from "./email";

// Neon pooled connection (DATABASE_URL, "-pooler" host) for app traffic. On Vercel Fluid compute,
// attachDatabasePool closes idle clients before the instance suspends; elsewhere it is a no-op.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
attachDatabasePool(pool);

/**
 * The header carrying the real client IP for rate limits. It must be one the platform sets itself and a client
 * can't supply: Cloudflare overwrites cf-connecting-ip, Vercel overwrites x-real-ip. X-Forwarded-For is only
 * appended to on Cloudflare, so a client could otherwise force every sign-in into one shared bucket.
 * AUTH_IP_HEADER overrides the detection (e.g. behind another proxy).
 */
const onCloudflare = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
const ipHeader = process.env.AUTH_IP_HEADER || (onCloudflare ? "cf-connecting-ip" : process.env.VERCEL ? "x-real-ip" : "x-forwarded-for");

/**
 * Per-account sign-in lockout, on top of the per-IP limit: a botnet spreading guesses across IPs still gets only
 * SIGNIN_MAX_FAILURES per account per window. Counted in FastAPI's api_rate table (migration 0003), keyed by a
 * hash of the email so no address is stored. Applies to unknown emails too, so it reveals nothing about accounts.
 */
const SIGNIN_MAX_FAILURES = 10;
const SIGNIN_WINDOW_SECONDS = 15 * 60;

async function signinKey(email: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email.trim().toLowerCase()));
  return `signin:${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 48)}`;
}

function signinWindow(): Date {
  const now = Math.floor(Date.now() / 1000);
  return new Date((now - (now % SIGNIN_WINDOW_SECONDS)) * 1000);
}

function emailOf(body: unknown): string | null {
  const email = (body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" && email.length <= 320 ? email : null;
}

/** Sends after the response, so the reply time doesn't reveal whether an account exists. */
function sendLater(to: string, subject: string, text: string) {
  after(() => sendEmail({ to, subject, text }).catch((err) => console.error("auth email failed:", err instanceof Error ? err.message : err)));
}

/**
 * Server-side auth. Tables (user, session, account, verification, rateLimit, twoFactor) live in the same Postgres
 * database as the FastAPI data; FastAPI validates the session cookie against `session`.
 * Secret and base URL come from BETTER_AUTH_SECRET / BETTER_AUTH_URL; cookies are HttpOnly, SameSite=Lax and
 * Secure whenever BETTER_AUTH_URL is https.
 */
export const auth = betterAuth({
  database: pool,
  appName: "Rankwise",
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // once every account has verified, AUTH_REQUIRE_EMAIL_VERIFICATION=true also makes sign-up enumeration-proof
    requireEmailVerification: emailEnabled && process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true",
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 30 * 60,
    ...(emailEnabled && {
      sendResetPassword: async ({ user, url }) =>
        sendLater(user.email, "Reset your Rankwise password", `Someone asked to reset the password for this Rankwise account.\n\nReset it here (the link works once, for 30 minutes):\n${url}\n\nIf it wasn't you, ignore this email: your password stays the same.`),
    }),
  },
  ...(emailEnabled && {
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 24 * 60 * 60,
      sendVerificationEmail: async ({ user, url }) =>
        sendLater(user.email, "Confirm your email for Rankwise", `Confirm this address for your Rankwise account:\n${url}\n\nThe link works for 24 hours. If you didn't sign up, ignore this email.`),
    },
  }),
  // self-serve deletion (privacy policy); the caller re-enters their password. Every Rankwise table references
  // "user" with ON DELETE CASCADE, so sites, audits, credits and billing rows go with it.
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        // never leave a renewing Razorpay subscription behind an account that no longer exists
        const renewing = await pool.query(
          `SELECT 1 FROM subscriptions WHERE user_id = $1 AND status IN ('authenticated', 'active', 'pending') AND NOT cancel_at_cycle_end LIMIT 1`,
          [user.id],
        );
        if (renewing.rowCount) {
          throw new APIError("BAD_REQUEST", { message: "Cancel your paid plan in Billing first, then delete your account." });
        }
      },
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  advanced: { ipAddress: { ipAddressHeaders: [ipHeader] } },
  // counters live in Postgres so every serverless instance shares them (in-memory limits reset per instance);
  // the `rateLimit` table is created by `npx auth migrate`. Stricter windows on the endpoints worth guessing at.
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 3600, max: 5 },
      "/request-password-reset": { window: 3600, max: 5 },
      "/reset-password": { window: 3600, max: 10 },
      "/send-verification-email": { window: 3600, max: 5 },
      "/change-password": { window: 3600, max: 10 },
      "/delete-user": { window: 3600, max: 5 },
      "/two-factor/verify-totp": { window: 60, max: 5 },
      "/two-factor/verify-backup-code": { window: 60, max: 5 },
      "/two-factor/enable": { window: 3600, max: 10 },
      "/two-factor/disable": { window: 3600, max: 10 },
      "/two-factor/get-totp-uri": { window: 3600, max: 10 },
      "/two-factor/generate-backup-codes": { window: 3600, max: 5 },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = emailOf(ctx.body);
      if (!email) return;
      const { rows } = await pool.query<{ count: number }>("SELECT count FROM api_rate WHERE key = $1 AND window_start = $2", [await signinKey(email), signinWindow()]);
      if ((rows[0]?.count ?? 0) >= SIGNIN_MAX_FAILURES) {
        throw new APIError("TOO_MANY_REQUESTS", { message: "Too many failed sign-ins for this email. Wait 15 minutes, or reset your password." });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = emailOf(ctx.body);
      if (!email) return;
      const key = await signinKey(email);
      const returned = ctx.context.returned;
      if (returned instanceof APIError) {
        if (returned.statusCode === 401) {
          await pool.query(
            "INSERT INTO api_rate (key, window_start, count) VALUES ($1, $2, 1) ON CONFLICT (key, window_start) DO UPDATE SET count = api_rate.count + 1",
            [key, signinWindow()],
          );
        }
      } else {
        await pool.query("DELETE FROM api_rate WHERE key = $1", [key]); // right password: start over
      }
    }),
  },
  plugins: [
    // refuses passwords from known breaches on sign-up, change and reset (k-anonymity: only 5 hash characters leave)
    haveIBeenPwned({ customPasswordCompromisedMessage: "This password appeared in a data breach. Choose a different one." }),
    // optional authenticator-app codes, with backup codes; `npx auth migrate` adds the twoFactor table
    twoFactor({ issuer: "Rankwise", backupCodeOptions: { amount: 10 } }),
    nextCookies(), // must stay last
  ],
});
