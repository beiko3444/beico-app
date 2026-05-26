import type { NextConfig } from "next";

const fallbackNextAuthUrl = "https://www.beiko.co.kr";
const configuredNextAuthUrl = process.env.NEXTAUTH_URL?.trim();
const configuredVercelUrl = process.env.VERCEL_URL?.trim();

process.env.NEXTAUTH_URL =
  configuredNextAuthUrl ||
  (configuredVercelUrl
    ? configuredVercelUrl.startsWith("http")
      ? configuredVercelUrl
      : `https://${configuredVercelUrl}`
    : fallbackNextAuthUrl);

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
  serverExternalPackages: ['playwright-core', '@sparticuz/chromium', '@napi-rs/canvas', 'pdf-parse', 'pdfjs-dist'],
  outputFileTracingIncludes: {
    '/api/admin/worm-order/remittance': ['./node_modules/@sparticuz/chromium/**/*'],
    '/api/admin/worm-order/emails/match': [
      './node_modules/pdf-parse/**/*',
      './node_modules/pdfjs-dist/**/*',
    ],
  },
  async headers() {
    return [
      {
        source: '/logo.png',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, immutable' }],
      },
      {
        source: '/seal.png',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, immutable' }],
      },
      {
        source: '/stamp.png',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, immutable' }],
      },
      {
        source: '/bko.png',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, immutable' }],
      },
      {
        source: '/pdf.worker.min.mjs',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, immutable' }],
      },
    ]
  },
};

export default nextConfig;
