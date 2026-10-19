import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";

// Neon pooled connection (DATABASE_URL, "-pooler" host) for app traffic. On Vercel Fluid compute,
// attachDatabasePool closes idle clients before the instance suspends; elsewhere it is a no-op.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
attachDatabasePool(pool);

/**
 * Server-side auth. Tables (user, session, account, verification) live in the same Postgres
 * database as the FastAPI data; FastAPI validates the session cookie against `session`.
 * Secret and base URL come from BETTER_AUTH_SECRET / BETTER_AUTH_URL.
 */
export const auth = betterAuth({
  database: pool,
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
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
    },
  },
  plugins: [nextCookies()], // must stay last
});
