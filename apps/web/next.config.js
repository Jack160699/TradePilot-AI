const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Standalone output in a monorepo must trace from the repo root so that
  // workspace packages are bundled into .next/standalone for Docker.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    '@tradepilot/ui',
    '@tradepilot/db',
    '@tradepilot/ai',
    '@tradepilot/trading',
    '@tradepilot/marketdata',
    '@tradepilot/notifications',
    '@tradepilot/analytics',
    '@tradepilot/config',
  ],
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://s3.tradingview.com https://www.tradingview-widget.com https://accounts.google.com https://apis.google.com",
              "style-src 'self' 'unsafe-inline' https://accounts.google.com",
              "img-src 'self' data: https:",
              "frame-src 'self' https://s.tradingview.com https://www.tradingview-widget.com https://accounts.google.com",
              "connect-src 'self' https://api.openai.com https://api.stripe.com https://accounts.google.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
