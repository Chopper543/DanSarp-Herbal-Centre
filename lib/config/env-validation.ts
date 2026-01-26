/**
 * Environment Variable Validation
 * Validates required and recommended environment variables
 */

import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Schema for required environment variables
 */
const requiredEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  NEXT_PUBLIC_SITE_URL: z.string().url("NEXT_PUBLIC_SITE_URL must be a valid URL"),
  CSRF_SECRET: z.string().min(32, "CSRF_SECRET must be at least 32 characters"),
});

/**
 * Schema for recommended environment variables (warnings only)
 */
const recommendedEnvSchema = z.object({
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
});

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate environment variables
 * @param strict - If true, fail on missing recommended vars in production
 * @returns Validation result
 */
export function validateEnv(strict: boolean = false): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required variables
  try {
    requiredEnvSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      CSRF_SECRET: process.env.CSRF_SECRET,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        errors.push(`${err.path.join(".")}: ${err.message}`);
      });
    } else {
      errors.push("Unknown validation error");
    }
  }

  // Check recommended variables (warnings only, unless strict mode in production)
  if (isProduction || strict) {
    const recommended = {
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
      FLUTTERWAVE_SECRET_KEY: process.env.FLUTTERWAVE_SECRET_KEY,
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    };

    if (!recommended.NEXT_PUBLIC_SENTRY_DSN) {
      warnings.push("NEXT_PUBLIC_SENTRY_DSN is not set - error monitoring will be disabled");
    }

    if (!recommended.UPSTASH_REDIS_REST_URL || !recommended.UPSTASH_REDIS_REST_TOKEN) {
      warnings.push(
        "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set - rate limiting will use in-memory storage (not suitable for production)"
      );
    }

    if (!recommended.RESEND_API_KEY) {
      warnings.push("RESEND_API_KEY is not set - email functionality will not work");
    }

    if (!recommended.PAYSTACK_SECRET_KEY && !recommended.FLUTTERWAVE_SECRET_KEY) {
      warnings.push(
        "No payment provider keys configured - payment functionality will not work"
      );
    }

    // Validate Google Maps API key format if provided
    if (recommended.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
      const apiKey = recommended.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.trim();
      if (apiKey.length > 0) {
        // Validate format: should start with "AIza" and be reasonable length
        if (!apiKey.startsWith("AIza") || apiKey.length < 30 || apiKey.length > 50) {
          warnings.push(
            "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY appears to be invalid - should start with 'AIza' and be ~39 characters"
          );
        }
      }
    } else {
      warnings.push(
        "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set - Google Maps will use fallback mode (less reliable). Run 'npm run setup:google-maps' to configure"
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate and throw if invalid (for build-time validation)
 */
export function validateEnvOrThrow(): void {
  const result = validateEnv(true);

  if (!result.valid) {
    console.error("❌ Environment variable validation failed:");
    result.errors.forEach((error) => console.error(`  - ${error}`));
    throw new Error("Environment variable validation failed");
  }

  if (result.warnings.length > 0) {
    console.warn("⚠️  Environment variable warnings:");
    result.warnings.forEach((warning) => console.warn(`  - ${warning}`));
  }
}
