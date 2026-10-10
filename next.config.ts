import type { NextConfig } from "next";

// cacheComponents is deliberately off: API routes read live state (seed + event log)
// on every request, and the classic model (`export const dynamic = "force-dynamic"`)
// is the simplest one for the whole team to reason about.
const nextConfig: NextConfig = {
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
