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

  // Ensure build output tracing stays within this workspace (avoids parent lockfile confusion)
  outputFileTracingRoot: __dirname,

  // isomorphic-dompurify pulls in jsdom for server-side sanitization. jsdom's
  // style-rules helper does `fs.readFileSync(path.resolve(__dirname, "../../browser/default-stylesheet.css"))`
  // at module load time. When webpack bundles it into a single server chunk,
  // __dirname resolves to the chunk's own directory (.next/server/chunks/),
  // not jsdom's real location, so that relative path resolves to a file Next
  // never copies (.next/browser/default-stylesheet.css) -> ENOENT during
  // "Collecting page data". Marking the package external keeps it as a real
  // node_modules require at runtime, where __dirname is jsdom's actual path.
  serverExternalPackages: ["isomorphic-dompurify", "jsdom"],

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

  // otplib's crypto/base32 plugins depend on @noble/hashes and @scure/base,
  // which ship ESM-only (no CJS build). Webpack already handles this fine at
  // runtime, but next/jest's transformIgnorePatterns reads this list to know
  // which node_modules packages it's also allowed to transform for tests.
  transpilePackages: ['@noble/hashes', '@scure/base'],

  // Note: Environment variable validation should be run manually before build
  // Use: npm run validate:env:strict
};

const shouldEnableSentry = !!process.env.NEXT_PUBLIC_SENTRY_DSN;

module.exports = shouldEnableSentry
  ? withSentryConfig(nextConfig, { silent: true })
  : nextConfig;
