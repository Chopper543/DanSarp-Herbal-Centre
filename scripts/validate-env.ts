#!/usr/bin/env node
/**
 * Standalone environment variable validation script
 * Usage: npx tsx scripts/validate-env.ts [--strict]
 */

// Load environment variables from .env.local
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local if it exists
config({ path: resolve(process.cwd(), ".env.local") });
// Also load .env if it exists (lower priority)
config({ path: resolve(process.cwd(), ".env") });

import { validateEnv } from "../lib/config/env-validation";

const strict = process.argv.includes("--strict");
const result = validateEnv(strict);

if (!result.valid) {
  console.error("\n❌ Environment variable validation failed:\n");
  result.errors.forEach((error: string) => console.error(`  ✗ ${error}`));
  process.exit(1);
}

if (result.warnings.length > 0) {
  console.warn("\n⚠️  Environment variable warnings:\n");
  result.warnings.forEach((warning: string) => console.warn(`  ⚠ ${warning}`));
  console.warn("\nThese are recommended but not required.\n");
}

console.log("✅ All required environment variables are set.\n");
process.exit(0);
