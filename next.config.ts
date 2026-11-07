import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Local-only files must never end up inside deployed server functions
  outputFileTracingExcludes: {
    "/*": ["./.data/**/*", "./uploads/**/*", "./node_modules/@embedded-postgres/**/*", "./scripts/**/*", "./tests/**/*"],
  },
};

export default nextConfig;
