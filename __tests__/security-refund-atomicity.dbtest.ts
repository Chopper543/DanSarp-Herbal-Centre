/**
 * @jest-environment node
 *
 * Refund atomicity + no-blind-retry — REAL Postgres (pglite/WASM), not mocks.
 *
 * RED (pre-fix fixtures): reproduces the two current bugs.
 *   (a) The process path does TWO separate DB writes (bump payments.refunded_amount,
 *       then mark refund_requests processed) with no transaction. A failure between
 *       them leaves split-brain: the payment is refunded on our books (and the
 *       ledger fired) while the request reads 'failed'. There is no atomic primitive
 *       (finalize_refund) today.
 *   (b) A post-provider failure lands in 'failed'. Nothing marks it "money may have
 *       moved", and there is no 'needs_reconciliation' state — so once returned to
 *       'approved' (an operator retrying a "failed, can retry" refund) the process
 *       claim re-acquires it and would call the provider AGAIN => double refund.
 *
 * GREEN (added after the RED checkpoint) drives the real finalize_refund RPC.
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

const SCHEMA_PATH = path.join(process.cwd(), "supabase/final_schema.sql");
const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260707000003_refund_atomic_finalize.sql"
);

function extract(sql: string, re: RegExp, label: string): string {
  const m = sql.match(re);
  if (!m) throw new Error(`Could not extract ${label} from SQL`);
  return m[0];
}
const RE_TXN_TYPE = /CREATE TYPE transaction_type AS ENUM \([^;]*\);/;
const RE_LEDGER_TABLE = /CREATE TABLE IF NOT EXISTS payment_ledger \([\s\S]*?\n\);/;
const RE_LEDGER_FN = /CREATE OR REPLACE FUNCTION update_payment_ledger\(\)[\s\S]*?\$\$;/;
const RE_LEDGER_TRIGGER = /DROP TRIGGER IF EXISTS payments_ledger[\s\S]*?EXECUTE FUNCTION update_payment_ledger\(\);/;

// Pre-fix refund_requests: BEFORE migration 20260707000003 (no needs_reconciliation,
// no provider_call_attempted_at/idempotency_key). The CHECK is explicitly named the
// way Postgres auto-names the real inline column CHECK, so the migration's
// DROP CONSTRAINT ... refund_requests_status_check resolves against it.
const PREFIX_REFUND_REQUESTS = `
CREATE TABLE refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id),
  requested_by uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'pending'
    CONSTRAINT refund_requests_status_check
    CHECK (status IN ('pending','approved','processing','rejected','processed','failed')),
  tier text NOT NULL DEFAULT 'full',
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  provider_refund_id text,
  processed_by uuid,
  processed_at timestamptz,
  failure_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);`;

/** Base (pre-migration) schema: real payments/ledger + pre-fix refund_requests. */
async function buildBaseDb(): Promise<PGlite> {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  const db = new PGlite();
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE ROLE service_role NOLOGIN;
    CREATE OR REPLACE FUNCTION uuid_generate_v4() RETURNS uuid
      LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
    CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    CREATE TABLE appointments (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    CREATE TABLE payments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users(id),
      amount numeric(10,2) NOT NULL,
      refunded_amount numeric(10,2) NOT NULL DEFAULT 0,
      status text,
      updated_at timestamptz DEFAULT now(),
      CONSTRAINT payments_refunded_amount_not_over CHECK (refunded_amount <= amount)
    );
  `);
  await db.exec(extract(schema, RE_TXN_TYPE, "transaction_type enum"));
  await db.exec(extract(schema, RE_LEDGER_TABLE, "payment_ledger table"));
  await db.exec(extract(schema, RE_LEDGER_FN, "update_payment_ledger()"));
  await db.exec(extract(schema, RE_LEDGER_TRIGGER, "payments_ledger trigger"));
  await db.exec(PREFIX_REFUND_REQUESTS);
  return db;
}

const USER = "11111111-1111-1111-1111-111111111111";
const PAY = "22222222-2222-2222-2222-222222222222";
const REQ = "33333333-3333-3333-3333-333333333333";

async function seedCompletedPaymentAndClaimedRefund(db: PGlite) {
  await db.exec(`INSERT INTO users (id) VALUES ('${USER}');`);
  // status 'completed' on insert fires the ledger 'payment' entry (real trigger).
  await db.exec(
    `INSERT INTO payments (id, user_id, amount, refunded_amount, status)
     VALUES ('${PAY}','${USER}',500.00,0,'completed');`
  );
  await db.exec(
    `INSERT INTO refund_requests (id, payment_id, requested_by, status, tier, amount)
     VALUES ('${REQ}','${PAY}','${USER}','processing','full',500.00);`
  );
}

describe("RED (a) — the two local writes are non-atomic (split-brain)", () => {
  let db: PGlite;
  beforeAll(async () => { db = await buildBaseDb(); await seedCompletedPaymentAndClaimedRefund(db); });
  afterAll(async () => db.close());

  it("a finalize-step failure leaves the payment refunded but the request 'failed'", async () => {
    // No finalize_refund RPC exists today — prove it.
    const fn = await db.query(`SELECT proname FROM pg_proc WHERE proname = 'finalize_refund'`);
    expect(fn.rows.length).toBe(0);

    // Write #1 (route :245): bump payment. Separate autocommit statement -> durable.
    // Fires the payment_ledger 'refund' entry via the real trigger.
    await db.query(
      `UPDATE payments SET refunded_amount = 500.00, status = 'refunded' WHERE id = '${PAY}'`
    );
    // Write #2 (route :255) FAILS -> the catch (route :279) marks the request 'failed'.
    await db.query(`UPDATE refund_requests SET status = 'failed' WHERE id = '${REQ}'`);

    // SPLIT-BRAIN: books say refunded, request says failed.
    const pay = (await db.query<any>(`SELECT refunded_amount, status FROM payments WHERE id='${PAY}'`)).rows[0];
    expect(Number(pay.refunded_amount)).toBe(500);
    expect(pay.status).toBe("refunded");

    const ledger = await db.query<any>(`SELECT transaction_type FROM payment_ledger WHERE payment_id='${PAY}' AND transaction_type='refund'`);
    expect(ledger.rows.length).toBe(1); // the ledger recorded the refund

    const req = (await db.query<any>(`SELECT status FROM refund_requests WHERE id='${REQ}'`)).rows[0];
    expect(req.status).toBe("failed"); // ...but the request reads failed -> split-brain
  });
});

describe("RED (b) — post-provider failure is re-runnable (double-refund path)", () => {
  let db: PGlite;
  beforeAll(async () => { db = await buildBaseDb(); await seedCompletedPaymentAndClaimedRefund(db); });
  afterAll(async () => db.close());

  it("there is no 'needs_reconciliation' state to mark money-may-have-moved", async () => {
    await expect(
      db.query(`UPDATE refund_requests SET status = 'needs_reconciliation' WHERE id = '${REQ}'`)
    ).rejects.toThrow(/violates check constraint|check/i);
  });

  it("a re-approved money-moved refund is re-claimable by process -> would re-call the provider", async () => {
    // Money already moved (as in RED-a), refund landed 'failed'; an operator
    // "retries" by re-approving it. Nothing distinguishes it from a safe retry.
    await db.query(`UPDATE refund_requests SET status = 'approved' WHERE id = '${REQ}'`);

    // The process claim (route :209-215): status='approved' -> 'processing'.
    const claimed = await db.query<any>(
      `UPDATE refund_requests SET status='processing' WHERE id='${REQ}' AND status='approved' RETURNING id`
    );
    expect(claimed.rows.length).toBe(1); // re-claimed -> the provider would be called AGAIN
  });
});

// ===========================================================================
// GREEN — the fix (real finalize_refund RPC from the migration)
// ===========================================================================
async function buildFixedDb(): Promise<PGlite> {
  const db = await buildBaseDb();
  await db.exec(fs.readFileSync(MIGRATION_PATH, "utf8"));
  return db;
}

describe("GREEN — finalize_refund is atomic (both writes or neither)", () => {
  it("commits payment bump + request 'processed' + ledger entry together", async () => {
    const db = await buildFixedDb();
    await seedCompletedPaymentAndClaimedRefund(db); // payment 500/0, refund processing 500
    await db.query(`SELECT * FROM finalize_refund($1,$2)`, [REQ, "prov_ref_1"]);

    const pay = (await db.query<any>(`SELECT refunded_amount,status FROM payments WHERE id='${PAY}'`)).rows[0];
    expect(Number(pay.refunded_amount)).toBe(500);
    expect(pay.status).toBe("refunded");
    const req = (await db.query<any>(`SELECT status,provider_refund_id FROM refund_requests WHERE id='${REQ}'`)).rows[0];
    expect(req.status).toBe("processed");
    expect(req.provider_refund_id).toBe("prov_ref_1");
    const led = (await db.query<any>(`SELECT count(*)::int n FROM payment_ledger WHERE payment_id='${PAY}' AND transaction_type='refund'`)).rows[0].n;
    expect(led).toBe(1); // ledger entry atomic with the refund
    await db.close();
  });

  it("a mid-RPC failure (over-refund) commits NEITHER write and NO ledger row", async () => {
    const db = await buildFixedDb();
    await db.exec(`INSERT INTO users (id) VALUES ('${USER}');`);
    await db.exec(`INSERT INTO payments (id,user_id,amount,refunded_amount,status) VALUES ('${PAY}','${USER}',500,0,'completed');`);
    // refund amount 600 > captured 500 -> the RPC RAISEs (before any write commits).
    await db.exec(`INSERT INTO refund_requests (id,payment_id,requested_by,status,tier,amount) VALUES ('${REQ}','${PAY}','${USER}','processing','full',600);`);

    await expect(db.query(`SELECT * FROM finalize_refund($1,$2)`, [REQ, "x"])).rejects.toThrow(/exceed/i);

    const pay = (await db.query<any>(`SELECT refunded_amount,status FROM payments WHERE id='${PAY}'`)).rows[0];
    expect(Number(pay.refunded_amount)).toBe(0);   // payment unchanged
    expect(pay.status).toBe("completed");
    const req = (await db.query<any>(`SELECT status FROM refund_requests WHERE id='${REQ}'`)).rows[0];
    expect(req.status).toBe("processing");          // request unchanged
    const led = (await db.query<any>(`SELECT count(*)::int n FROM payment_ledger WHERE payment_id='${PAY}' AND transaction_type='refund'`)).rows[0].n;
    expect(led).toBe(0);                            // no ledger row
    await db.close();
  });
});

describe("GREEN — finalize_refund is idempotent", () => {
  it("a double-call is a no-op: refunded_amount not double-bumped, one ledger row", async () => {
    const db = await buildFixedDb();
    await seedCompletedPaymentAndClaimedRefund(db);
    await db.query(`SELECT * FROM finalize_refund($1,$2)`, [REQ, "prov_ref_1"]);
    await db.query(`SELECT * FROM finalize_refund($1,$2)`, [REQ, "prov_ref_1"]); // retry / duplicate

    const pay = (await db.query<any>(`SELECT refunded_amount FROM payments WHERE id='${PAY}'`)).rows[0];
    expect(Number(pay.refunded_amount)).toBe(500);  // NOT 1000
    const req = (await db.query<any>(`SELECT status FROM refund_requests WHERE id='${REQ}'`)).rows[0];
    expect(req.status).toBe("processed");
    const led = (await db.query<any>(`SELECT count(*)::int n FROM payment_ledger WHERE payment_id='${PAY}' AND transaction_type='refund'`)).rows[0].n;
    expect(led).toBe(1);
    await db.close();
  });
});

describe("GREEN — needs_reconciliation closes the double-refund door", () => {
  it("a needs_reconciliation refund is NOT re-claimable by process (.eq approved -> 0 rows)", async () => {
    const db = await buildFixedDb();
    await seedCompletedPaymentAndClaimedRefund(db);
    // The fix routes a maybe-money-moved failure here (never 'failed').
    await db.query(`UPDATE refund_requests SET status='needs_reconciliation' WHERE id='${REQ}'`);

    // The process claim guard can NEVER re-acquire it -> no blind re-refund.
    const claim = await db.query<any>(
      `UPDATE refund_requests SET status='processing' WHERE id='${REQ}' AND status='approved' RETURNING id`
    );
    expect(claim.rows.length).toBe(0); // door closed
    // And the approve action can't touch it either (requires 'pending').
    const appr = await db.query<any>(
      `UPDATE refund_requests SET status='approved' WHERE id='${REQ}' AND status='pending' RETURNING id`
    );
    expect(appr.rows.length).toBe(0);
    await db.close();
  });
});

describe("GREEN — the process claim serializes (timing-independent)", () => {
  it("only ONE claim on an 'approved' row succeeds; a second returns 0 rows", async () => {
    const db = await buildFixedDb();
    await db.exec(`INSERT INTO users (id) VALUES ('${USER}');`);
    await db.exec(`INSERT INTO payments (id,user_id,amount,status) VALUES ('${PAY}','${USER}',500,'completed');`);
    await db.exec(`INSERT INTO refund_requests (id,payment_id,requested_by,status,tier,amount) VALUES ('${REQ}','${PAY}','${USER}','approved','full',500);`);

    const claimSql = `UPDATE refund_requests SET status='processing' WHERE id='${REQ}' AND status='approved' RETURNING id`;
    const first = await db.query<any>(claimSql);
    const second = await db.query<any>(claimSql);
    expect(first.rows.length).toBe(1);  // one worker claims
    expect(second.rows.length).toBe(0); // the other cannot reach the provider
    await db.close();
  });
});
