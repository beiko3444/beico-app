import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['playwright-core', '@sparticuz/chromium'],
};

export default nextConfig;
