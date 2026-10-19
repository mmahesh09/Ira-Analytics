import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Prerendered pages are served from the read-only Workers Static Assets cache (no ISR/revalidation yet,
// so no R2/KV needed). Cache interception stays off: it doesn't work with PPR (cacheComponents).
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
