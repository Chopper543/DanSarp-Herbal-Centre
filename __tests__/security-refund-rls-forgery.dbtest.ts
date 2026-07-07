/**
 * @jest-environment node
 *
 * RLS forgery test for refund_requests INSERT.
 *
 * This exercises REAL Postgres row-level security via pglite (Postgres compiled
 * to WASM), NOT a mock. RLS is the thing under test, so a mock would be
 * worthless here. The test:
 *   - loads the ACTUAL `refund_requests` table DDL and the ACTUAL
 *     `is_finance_staff_user()` function from supabase/final_schema.sql,
 *   - applies a policy under test (current policy from the schema, or the fixed
 *     policy from the migration),
 *   - connects as the Postgres `authenticated` role with a Supabase-shaped JWT
 *     claim (so `auth.uid()` resolves like production) and as `service_role`
 *     (BYPASSRLS, like the Supabase service key),
 *   - and asserts whether an INSERT is permitted by RLS.
 *
 * Threat model: a patient using the Supabase JS client with their own JWT tries
 * to forge a refund_request for a payment they don't own, at tier 'full' for the
 * full amount, bypassing the server-side cancellation policy.
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

const SCHEMA_PATH = path.join(process.cwd(), "supabase/final_schema.sql");
const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260707000001_refund_requests_insert_finance_only.sql"
);

// Fixed uuids so we can reason about ownership.
const ATTACKER = "11111111-1111-1111-1111-111111111111"; // role 'user' (patient)
const VICTIM = "22222222-2222-2222-2222-222222222222"; // role 'user', owns the payment
const FINANCE = "33333333-3333-3333-3333-333333333333"; // role 'finance_manager'
const VICTIM_PAYMENT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

/** Pull an exact SQL statement/block out of a .sql file so we test shipped SQL. */
function extract(sql: string, re: RegExp, label: string): string {
  const m = sql.match(re);
  if (!m) throw new Error(`Could not extract ${label} from SQL`);
  return m[0];
}

const RE_REFUND_TABLE = /CREATE TABLE IF NOT EXISTS refund_requests \([\s\S]*?\n\);/;
const RE_FINANCE_FN = /CREATE OR REPLACE FUNCTION is_finance_staff_user\(\)[\s\S]*?\$\$;/;
const RE_INSERT_POLICY = /CREATE POLICY refund_requests_insert_admin ON refund_requests[\s\S]*?;/;

/** Build a pglite DB whose refund_requests + helper fn come from the real schema. */
async function buildDb(): Promise<PGlite> {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  const db = new PGlite();

  // Supabase-shaped roles + auth.uid() reading the JWT 'sub' claim.
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    GRANT USAGE ON SCHEMA auth, extensions TO anon, authenticated, service_role;
    -- final_schema.sql defaults use uuid_generate_v4(); shim to the built-in.
    CREATE OR REPLACE FUNCTION uuid_generate_v4() RETURNS uuid
      LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
    -- Matches Supabase's auth.uid(): nullif(jwt->>'sub','')::uuid
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
    $$;
  `);

  // Minimal owner tables the real refund_requests DDL FKs to.
  await db.exec(`
    CREATE TABLE users (id uuid PRIMARY KEY, role text NOT NULL DEFAULT 'user');
    CREATE TABLE payments (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id),
      amount numeric(10,2) NOT NULL
    );
    CREATE TABLE appointments (id uuid PRIMARY KEY);
  `);

  // The REAL table + REAL helper function, straight from the shipped schema.
  await db.exec(extract(schema, RE_REFUND_TABLE, "refund_requests table"));
  await db.exec(extract(schema, RE_FINANCE_FN, "is_finance_staff_user()"));

  await db.exec(`
    ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE ON refund_requests TO authenticated;
    GRANT SELECT, INSERT, UPDATE ON refund_requests TO service_role;
    GRANT SELECT ON users, payments TO authenticated, service_role;
  `);

  // Seed actors + a payment owned by VICTIM.
  await db.exec(`
    INSERT INTO users (id, role) VALUES
      ('${ATTACKER}', 'user'),
      ('${VICTIM}',   'user'),
      ('${FINANCE}',  'finance_manager');
    INSERT INTO payments (id, user_id, amount) VALUES
      ('${VICTIM_PAYMENT}', '${VICTIM}', 500.00);
  `);

  return db;
}

async function applyInsertPolicy(db: PGlite, policySql: string) {
  await db.exec(`DROP POLICY IF EXISTS refund_requests_insert_admin ON refund_requests;`);
  await db.exec(policySql);
}

/**
 * Attempt the forged INSERT as the Postgres `authenticated` role with the given
 * user's JWT. Returns "ALLOWED" if RLS permits it, or the RLS error message.
 * Runs in its own transaction and rolls back so tests don't leak rows.
 */
async function insertAsAuthenticated(
  db: PGlite,
  jwtSub: string,
  row: { payment_id: string; requested_by: string; tier: string; amount: number }
): Promise<"ALLOWED" | string> {
  await db.exec("BEGIN");
  try {
    await db.exec("SET LOCAL ROLE authenticated");
    await db.query("SELECT set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: jwtSub, role: "authenticated" }),
    ]);
    await db.query(
      `INSERT INTO refund_requests (payment_id, requested_by, tier, amount, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [row.payment_id, row.requested_by, row.tier, row.amount]
    );
    await db.exec("ROLLBACK");
    return "ALLOWED";
  } catch (e: any) {
    await db.exec("ROLLBACK");
    return String(e.message);
  }
}

async function insertAsServiceRole(
  db: PGlite,
  row: { payment_id: string; requested_by: string; tier: string; amount: number }
): Promise<"ALLOWED" | string> {
  await db.exec("BEGIN");
  try {
    await db.exec("SET LOCAL ROLE service_role");
    await db.query(
      `INSERT INTO refund_requests (payment_id, requested_by, tier, amount, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [row.payment_id, row.requested_by, row.tier, row.amount]
    );
    await db.exec("ROLLBACK");
    return "ALLOWED";
  } catch (e: any) {
    await db.exec("ROLLBACK");
    return String(e.message);
  }
}

// The forged row: attacker requests a FULL refund on the VICTIM's payment.
const FORGED = {
  payment_id: VICTIM_PAYMENT,
  requested_by: ATTACKER,
  tier: "full",
  amount: 500.0,
};

// The exact PRE-FIX policy, kept as a labeled regression fixture so the "the bug
// was real" proof stays stable even after final_schema.sql is corrected. This is
// verbatim what shipped in final_schema.sql before migration 20260707000001.
const VULNERABLE_POLICY = `
CREATE POLICY refund_requests_insert_admin ON refund_requests
  FOR INSERT WITH CHECK ((select is_finance_staff_user()) OR requested_by = (select auth.uid()));
`;

// RED — reproduces the vulnerability. Under the pre-fix policy the forged insert
// is permitted by RLS. (This is the exact policy the live final_schema.sql
// carried when this test was first run against it and passed.)
describe("refund_requests INSERT RLS — PRE-FIX policy (regression fixture)", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await buildDb();
    await applyInsertPolicy(db, VULNERABLE_POLICY);
  });
  afterAll(async () => db.close());

  it("BUG: a non-finance patient CAN forge a full-refund request on another user's payment", async () => {
    const result = await insertAsAuthenticated(db, ATTACKER, FORGED);
    expect(result).toBe("ALLOWED");
  });
});

// GREEN — the shipped migration closes the hole without over-tightening.
describe("refund_requests INSERT RLS — FIXED policy (migration 20260707000001)", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await buildDb();
    const migration = fs.readFileSync(MIGRATION_PATH, "utf8");
    await applyInsertPolicy(db, extract(migration, RE_INSERT_POLICY, "migration insert policy"));
  });
  afterAll(async () => db.close());

  it("blocks the forged patient insert (RLS denies)", async () => {
    const result = await insertAsAuthenticated(db, ATTACKER, FORGED);
    expect(result).toMatch(/row-level security/i);
  });

  it("still allows a finance-staff insert (not over-tightened)", async () => {
    const result = await insertAsAuthenticated(db, FINANCE, {
      ...FORGED,
      requested_by: VICTIM, // finance creates the request on behalf of the payer
    });
    expect(result).toBe("ALLOWED");
  });

  it("still allows the service-role insert (the real appointment-cancellation path)", async () => {
    // The legit creation path (app/api/appointments/route.ts:554-583) runs on the
    // service-role client, which bypasses RLS entirely — proven here directly.
    const result = await insertAsServiceRole(db, { ...FORGED, requested_by: VICTIM });
    expect(result).toBe("ALLOWED");
  });
});

// Guards the canonical schema: final_schema.sql must carry the fix too, so a DB
// built fresh from it (not just via migration) is not vulnerable.
describe("refund_requests INSERT RLS — canonical final_schema.sql carries the fix", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await buildDb();
    const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
    await applyInsertPolicy(db, extract(schema, RE_INSERT_POLICY, "canonical insert policy"));
  });
  afterAll(async () => db.close());

  it("blocks the forged patient insert (RLS denies)", async () => {
    const result = await insertAsAuthenticated(db, ATTACKER, FORGED);
    expect(result).toMatch(/row-level security/i);
  });
});
