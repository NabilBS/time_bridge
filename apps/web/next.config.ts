import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Das Shared-Paket liegt als TypeScript-Quelle vor und wird von Next transpiliert.
  transpilePackages: ["@zeitbruecke/shared"],
};

export default nextConfig;
