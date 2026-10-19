import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // same-origin API: the Better Auth cookie is first-party for both Next and FastAPI.
  // `fallback` so Next's own /api/auth/* route handler wins; everything else goes to FastAPI.
  async rewrites() {
    const backend = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");
    return { beforeFiles: [], afterFiles: [], fallback: [{ source: "/api/:path*", destination: `${backend}/api/:path*` }] };
  },
  // baseline security headers on every page: no framing (clickjacking on billing/settings), no MIME sniffing,
  // HTTPS only, and browser features off except payments, which Razorpay Checkout uses
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
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
