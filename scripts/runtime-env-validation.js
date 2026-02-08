/**
 * Lightweight runtime env validation callable from next.config.js without TypeScript.
 * Mirrors the required/recommended checks from lib/config/env-validation.ts.
 */

function validateEnvOrThrowRuntime(options = {}) {
  const { strict = process.env.NODE_ENV === "production" } = options;
  const errors = [];
  const warnings = [];

  const required = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    CSRF_SECRET: process.env.CSRF_SECRET,
  };

  Object.entries(required).forEach(([key, value]) => {
    if (!value || `${value}`.trim() === "") {
      errors.push(`${key} is required`);
    }
  });

  const recommended = {
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
    FLUTTERWAVE_SECRET_KEY: process.env.FLUTTERWAVE_SECRET_KEY,
    GHANA_RAILS_WEBHOOK_SECRET: process.env.GHANA_RAILS_WEBHOOK_SECRET,
    BULLMQ_REDIS_URL: process.env.BULLMQ_REDIS_URL || process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL,
    CRON_SECRET: process.env.CRON_SECRET,
  };

  if (strict) {
    if (!recommended.NEXT_PUBLIC_SENTRY_DSN) {
      warnings.push("NEXT_PUBLIC_SENTRY_DSN is not set - error monitoring disabled");
    }
    if (!recommended.UPSTASH_REDIS_REST_URL || !recommended.UPSTASH_REDIS_REST_TOKEN) {
      warnings.push("Upstash Redis is not configured - rate limiting will fail");
    }
    if (!recommended.RESEND_API_KEY) {
      warnings.push("RESEND_API_KEY is not set - transactional email disabled");
    }
    if (!recommended.PAYSTACK_SECRET_KEY && !recommended.FLUTTERWAVE_SECRET_KEY) {
      warnings.push("No payment provider keys configured - payments will fail");
    }
    if (!recommended.GHANA_RAILS_WEBHOOK_SECRET) {
      warnings.push("GHANA_RAILS_WEBHOOK_SECRET is not set - Ghana Rails webhooks will be rejected");
    }
    if (!recommended.BULLMQ_REDIS_URL) {
      warnings.push("BullMQ Redis is not configured - reminder/notification queue disabled");
    }
    if (!recommended.CRON_SECRET) {
      warnings.push("CRON_SECRET is not set - cron endpoints cannot be secured");
    }
  }

  if (errors.length) {
    const message = errors.join("; ");
    throw new Error(`Environment validation failed: ${message}`);
  }

  if (warnings.length) {
    // Surface warnings but do not crash
    console.warn("Environment warnings:", warnings.join("; "));
  }
}

module.exports = { validateEnvOrThrowRuntime };
