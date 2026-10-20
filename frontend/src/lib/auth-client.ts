import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

// same origin: /api/auth/* is handled by app/api/auth/[...all]/route.ts.
// Sign-in for accounts with two-factor on returns { twoFactorRedirect: true }; AuthForm sends them to /two-factor.
export const authClient = createAuthClient({ plugins: [twoFactorClient()] });
