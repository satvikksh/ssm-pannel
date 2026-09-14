import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The frontend reaches the NestJS API directly from the browser using
  // NEXT_PUBLIC_API_URL (see .env.local). No rewrites/proxies needed.
  reactStrictMode: true,
};

export default nextConfig;