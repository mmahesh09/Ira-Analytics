import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // same-origin API: the Better Auth cookie is first-party for both Next and FastAPI.
  // `fallback` so Next's own /api/auth/* route handler wins; everything else goes to FastAPI.
  async rewrites() {
    const backend = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");
    return { beforeFiles: [], afterFiles: [], fallback: [{ source: "/api/:path*", destination: `${backend}/api/:path*` }] };
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
