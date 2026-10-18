import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";

/**
 * Server-side auth. Tables (user, session, account, verification) live in the same Postgres
 * database as the FastAPI data; FastAPI validates the session cookie against `session`.
 * Secret and base URL come from BETTER_AUTH_SECRET / BETTER_AUTH_URL.
 */
export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  rateLimit: { enabled: true },
  plugins: [nextCookies()], // must stay last
});
