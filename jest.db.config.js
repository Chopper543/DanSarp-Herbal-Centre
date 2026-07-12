// Separate Jest config for DB-backed tests that exercise REAL Postgres (via
// pglite/WASM) — e.g. RLS policy tests. These require Node's
// --experimental-vm-modules (pglite loads its WASM via dynamic import), which is
// incompatible with the otplib tests in the main suite (@scure/base is ESM-only
// and can't be require()d under that flag). So DB tests run on their own:
//
//   npm run test:db
//
// Test files use the `.dbtest.ts` suffix and are excluded from the default
// `npm test` run (see testPathIgnorePatterns in jest.config.js).
const TEST_PADDING = "x".repeat(32);
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key";
process.env.NEXT_PUBLIC_SITE_URL ||= "https://test.example.com";
process.env.CSRF_SECRET ||= `csrf-${TEST_PADDING}`;
process.env.TWO_FA_ENC_KEY ||= `twofa-${TEST_PADDING}`;
process.env.TWO_FA_SESSION_SECRET ||= `twofa-session-${TEST_PADDING}`;
process.env.PHI_FIELD_KEY ||= `phi-${TEST_PADDING}`;
process.env.CRON_SECRET ||= `cron-${TEST_PADDING}`;

const nextJest = require("next/jest");
const createJestConfig = nextJest({ dir: "./" });

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/__tests__/**/*.dbtest.[jt]s?(x)"],
  testPathIgnorePatterns: ["<rootDir>/e2e/"],
};

module.exports = createJestConfig(customJestConfig);
