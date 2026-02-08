const { validateEnvOrThrowRuntime } = require("./scripts/runtime-env-validation");
const { withSentryConfig } = require("@sentry/nextjs");

// Fail fast on missing env vars (strict in production)
validateEnvOrThrowRuntime();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production optimizations
  compress: true,
  reactStrictMode: true,
  poweredByHeader: false, // Security: remove X-Powered-By header
  productionBrowserSourceMaps: false, // Security: disable source maps in production

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: '**.cloudinary.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    // Production image optimization
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // Note: Environment variable validation should be run manually before build
  // Use: npm run validate:env:strict
};

const shouldEnableSentry = !!process.env.NEXT_PUBLIC_SENTRY_DSN;

module.exports = shouldEnableSentry
  ? withSentryConfig(nextConfig, { silent: true })
  : nextConfig;
