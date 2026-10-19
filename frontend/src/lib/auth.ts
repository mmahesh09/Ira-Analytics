import { betterAuth } from "better-auth";
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
