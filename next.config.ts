import type { NextConfig } from 'next';

// Page responses also get a per-request nonce CSP from src/proxy.ts.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // One-tap links carry a token in the path, so the URL must never leak as a referrer.
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const apiCsp = { key: 'Content-Security-Policy', value: "default-src 'none'; frame-ancestors 'none'" };

const nextConfig: NextConfig = {
  output: 'standalone',
  // Pin the root to this folder so a stray lockfile higher up cannot change the build layout.
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/api/:path*', headers: [apiCsp] },
    ];
  },
};

export default nextConfig;
