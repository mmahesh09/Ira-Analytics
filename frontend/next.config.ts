import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";
const origin = (url?: string) => {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
};
// the audit stream is the one call the browser makes to the API directly; PostHog only when it's configured
// (its cloud serves scripts and ingestion from *.posthog.com; a self-hosted or proxied host is allowed as given)
const apiOrigin = origin(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_KEY ? origin(process.env.NEXT_PUBLIC_POSTHOG_HOST) : null;
const posthog = posthogHost ? (posthogHost.endsWith(".posthog.com") ? "https://*.posthog.com" : posthogHost) : "";

/**
 * Content Security Policy. Scripts are limited to this site and Razorpay Checkout; 'unsafe-inline' stays because
 * Next.js streams inline bootstrap scripts and prerendered (cached) pages can't carry a per-request nonce.
 * Everything else is narrowed: no plugins, no <base> hijacking, forms only to us, no framing by others.
 * CSP_REPORT_ONLY=true switches it to report-only, as a fast way back if a new integration is blocked.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${dev ? "'unsafe-eval'" : ""} https://checkout.razorpay.com ${posthog}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin ?? ""} https://api.razorpay.com https://lumberjack.razorpay.com ${posthog} ${dev ? "ws: http://localhost:*" : ""}`,
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://api.razorpay.com",
  "frame-ancestors 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
]
  .map((d) => d.replace(/\s+/g, " ").trim())
  .join("; ");
const cspHeader = process.env.CSP_REPORT_ONLY === "true" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // same-origin API: the Better Auth cookie is first-party for both Next and FastAPI.
  // `fallback` so Next's own /api/auth/* route handler wins; everything else goes to FastAPI.
  async rewrites() {
    const backend = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");
    return { beforeFiles: [], afterFiles: [], fallback: [{ source: "/api/:path*", destination: `${backend}/api/:path*` }] };
  },
  // baseline security headers on every page: CSP, no framing (clickjacking on billing/settings), no MIME sniffing,
  // HTTPS only, and browser features off except payments, which Razorpay Checkout uses
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: cspHeader, value: csp },
          // Razorpay Checkout may open a popup (3-D Secure, UPI apps) that has to talk back to this page
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: 'camera=(), microphone=(), geolocation=(), usb=(), payment=(self "https://api.razorpay.com" "https://checkout.razorpay.com")' },
        ],
      },
    ];
  },
  // pg loads its Workers TCP socket (pg-cloudflare) through a "workerd" export condition that file
  // tracing doesn't follow; ship the whole package so the Cloudflare build can bundle it
  outputFileTracingIncludes: { "/*": ["./node_modules/pg-cloudflare/**/*"] },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
