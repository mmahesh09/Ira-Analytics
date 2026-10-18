import { createAuthClient } from "better-auth/react";

// same origin: /api/auth/* is handled by app/api/auth/[...all]/route.ts
export const authClient = createAuthClient();
