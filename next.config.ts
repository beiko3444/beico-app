import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['playwright-core', '@sparticuz/chromium'],
  outputFileTracingIncludes: {
    '/api/admin/worm-order/remittance': ['./node_modules/@sparticuz/chromium/**/*'],
  },
};

export default nextConfig;
