import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // same-origin API: the Better Auth cookie is first-party for both Next and FastAPI.
  // `fallback` so Next's own /api/auth/* route handler wins; everything else goes to FastAPI.
  async rewrites() {
    const backend = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");
    return { beforeFiles: [], afterFiles: [], fallback: [{ source: "/api/:path*", destination: `${backend}/api/:path*` }] };
  },
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
