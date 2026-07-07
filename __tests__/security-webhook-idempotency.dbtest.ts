/**
 * @jest-environment node
 *
 * Webhook event idempotency — REAL Postgres (pglite/WASM), not mocks.
 *
 * RED (regression fixtures): reproduces the two bugs against the PRE-FIX shape.
 *   (a) A webhook whose processing FAILS is permanently dropped on retry — the
 *       old claim logic (INSERT, 23505 => "duplicate") has no way to say
 *       "failed, retry me", so the retry is skipped.
 *   (b) The pre-fix appointments table has no per-payment uniqueness, so nothing
 *       at the DB level stops a duplicate delivery from double-booking.
 *   (These fixtures are kept stable on purpose so the "the bug was real" proof
 *   survives the fix. The pre-fix run against the live code/schema was shown at
 *   the RED checkpoint before final_schema.sql / webhook-events.ts changed.)
 *
 * GREEN: drives the ACTUAL shipped functions (acquireWebhookEvent,
 *   markWebhookProcessed/Failed, ensureAppointmentForCompletedPayment) against a
 *   base schema with the REAL migration applied.
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import {
  acquireWebhookEvent,
  markWebhookProcessed,
  markWebhookFailed,
  WEBHOOK_MAX_ATTEMPTS,
} from "@/lib/payments/webhook-events";
import { ensureAppointmentForCompletedPayment } from "@/lib/payments/ensure-appointment";

const SCHEMA_PATH = path.join(process.cwd(), "supabase/final_schema.sql");
const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260707000002_webhook_event_idempotency.sql"
);

function extract(sql: string, re: RegExp, label: string): string {
  const m = sql.match(re);
  if (!m) throw new Error(`Could not extract ${label} from SQL`);
  return m[0];
}
const RE_APPOINTMENTS = /CREATE TABLE IF NOT EXISTS appointments \([\s\S]*?\n\);/;
const RE_APPT_STATUS_ENUM = /CREATE TYPE appointment_status AS ENUM \([^;]*\);/;

// Pre-fix webhook_events: the table BEFORE migration 20260707000002 (no status/
// attempts/lease). Kept inline because final_schema.sql now carries the fix.
const PREFIX_WEBHOOK_EVENTS = `
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  payload JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT webhook_events_provider_event_id_key UNIQUE (provider, event_id)
);`;

/** Base schema (pre-migration): stubs + real appointments + pre-fix webhook_events. */
async function buildBaseDb(): Promise<PGlite> {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  const db = new PGlite();
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE ROLE service_role NOLOGIN;
    CREATE OR REPLACE FUNCTION uuid_generate_v4() RETURNS uuid
      LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
    CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    CREATE TABLE branches (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    CREATE TABLE payments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users(id),
      amount numeric(10,2),
      status text,
      metadata jsonb,
      appointment_id uuid
    );
  `);
  await db.exec(extract(schema, RE_APPT_STATUS_ENUM, "appointment_status enum"));
  await db.exec(extract(schema, RE_APPOINTMENTS, "appointments table"));
  await db.exec(PREFIX_WEBHOOK_EVENTS);
  return db;
}

/** Fixed schema: base + the REAL migration file applied. */
async function buildFixedDb(): Promise<PGlite> {
  const db = await buildBaseDb();
  await db.exec(fs.readFileSync(MIGRATION_PATH, "utf8"));
  return db;
}

/**
 * Minimal supabase-shaped client over pglite, enough to drive the REAL shipped
 * functions: `.rpc(...)`, `.from().insert().select().single()`,
 * `.from().select().eq().single()`, `.from().update().eq()...`. Errors carry the
 * Postgres SQLSTATE on `error.code` (23505 etc.), like PostgREST.
 */
function pgClient(db: PGlite) {
  async function execChain(s: any): Promise<{ data: any; error: any }> {
    const cast = (v: any, i: number) =>
      v !== null && typeof v === "object" ? `$${i + 1}::jsonb` : `$${i + 1}`;
    const param = (v: any) => (v !== null && typeof v === "object" ? JSON.stringify(v) : v ?? null);
    try {
      if (s.op === "insert") {
        const cols = Object.keys(s.values);
        const ph = cols.map((c, i) => cast(s.values[c], i));
        const params = cols.map((c) => param(s.values[c]));
        const ret = s.returning ? " RETURNING *" : "";
        const r = await db.query(
          `INSERT INTO ${s.table} (${cols.join(",")}) VALUES (${ph.join(",")})${ret}`,
          params
        );
        const data = s.returning ? (s.single ? r.rows[0] : r.rows) : null;
        return { data, error: null };
      }
      if (s.op === "update") {
        const cols = Object.keys(s.values);
        const setSql = cols.map((c, i) => `${c}=${cast(s.values[c], i)}`).join(",");
        const params = cols.map((c) => param(s.values[c]));
        const whereSql = s.conds
          .map(([c]: [string], i: number) => `${c}=$${cols.length + i + 1}`)
          .join(" AND ");
        params.push(...s.conds.map(([, v]: [string, any]) => v));
        await db.query(
          `UPDATE ${s.table} SET ${setSql}${whereSql ? ` WHERE ${whereSql}` : ""}`,
          params
        );
        return { data: null, error: null };
      }
      // select
      const whereSql = s.conds
        .map(([c]: [string], i: number) => `${c}=$${i + 1}`)
        .join(" AND ");
      const r = await db.query(
        `SELECT * FROM ${s.table}${whereSql ? ` WHERE ${whereSql}` : ""}`,
        s.conds.map(([, v]: [string, any]) => v)
      );
      if (s.single) {
        if (r.rows.length === 0) return { data: null, error: { code: "PGRST116", message: "no rows" } };
        return { data: r.rows[0], error: null };
      }
      return { data: r.rows, error: null };
    } catch (e: any) {
      return { data: null, error: { code: e.code, message: e.message } };
    }
  }

  function chain(table: string) {
    const s: any = { table, op: null, values: null, conds: [], single: false, returning: false };
    const api: any = {
      insert(row: any) { s.op = "insert"; s.values = row; return api; },
      update(obj: any) { s.op = "update"; s.values = obj; return api; },
      select() { if (s.op === "insert") s.returning = true; else s.op = "select"; return api; },
      eq(c: string, v: any) { s.conds.push([c, v]); return api; },
      single() { s.single = true; return api; },
      maybeSingle() { s.single = true; return api; },
      then(res: any, rej: any) { execChain(s).then(res, rej); },
    };
    return api;
  }

  return {
    from: (table: string) => chain(table),
    async rpc(fn: string, p: any) {
      if (fn !== "acquire_webhook_event") throw new Error("unknown rpc " + fn);
      try {
        const r = await db.query(
          `SELECT result, attempts FROM acquire_webhook_event($1,$2,$3,$4::jsonb,$5,$6::interval)`,
          [
            p.p_provider,
            p.p_event_id,
            p.p_event_type ?? null,
            p.p_payload == null ? null : JSON.stringify(p.p_payload),
            p.p_max_attempts,
            p.p_lease,
          ]
        );
        return { data: r.rows, error: null };
      } catch (e: any) {
        return { data: null, error: { code: e.code, message: e.message } };
      }
    },
  };
}

// ===========================================================================
// RED — pre-fix fixtures reproduce the bugs
// ===========================================================================
describe("RED (a) — pre-fix: failed webhook event is permanently dropped on retry", () => {
  let db: PGlite;
  beforeAll(async () => { db = await buildBaseDb(); });
  afterAll(async () => db.close());

  it("the old claim (INSERT + 23505=duplicate) skips a FAILED event's retry", async () => {
    // Reproduces the deleted claimWebhookEvent: first INSERT claims, retry hits
    // the unique constraint and is treated as 'duplicate' -> handler returns 200.
    const claim = async () => {
      try {
        await db.query(
          `INSERT INTO webhook_events (provider, event_id, event_type) VALUES ('paystack','evt_1','charge.success')`
        );
        return "claimed";
      } catch (e: any) {
        return e.code === "23505" ? "duplicate" : "error:" + e.code;
      }
    };
    expect(await claim()).toBe("claimed"); // 1st delivery
    // processing FAILS: row stays, nothing can mark it failed (no status column)
    expect(await claim()).toBe("duplicate"); // retry -> dropped, never reprocessed

    const cols = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name='webhook_events'`
    );
    expect(cols.rows.map((r) => r.column_name)).not.toContain("status");
  });
});

describe("RED (b) — pre-fix: appointments schema permits double-booking", () => {
  let db: PGlite;
  beforeAll(async () => { db = await buildBaseDb(); });
  afterAll(async () => db.close());

  it("two appointments can be created for one payment; no unique guard exists", async () => {
    await db.exec(`
      INSERT INTO users (id) VALUES ('11111111-1111-1111-1111-111111111111');
      INSERT INTO branches (id) VALUES ('22222222-2222-2222-2222-222222222222');
      INSERT INTO payments (id, user_id, amount, status)
        VALUES ('33333333-3333-3333-3333-333333333333',
                '11111111-1111-1111-1111-111111111111', 500.00, 'completed');
    `);
    const insertAppt = () =>
      db.query(
        `INSERT INTO appointments (user_id, branch_id, appointment_date, treatment_type, status)
         VALUES ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
                 NOW(),'consultation','pending')`
      );
    await insertAppt();
    await insertAppt();
    const count = await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM appointments`);
    expect(count.rows[0].n).toBe(2); // double-booked

    const idx = await db.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename='appointments'`
    );
    expect(idx.rows.map((r) => r.indexname)).not.toContain("appointments_one_per_payment");
  });
});

// ===========================================================================
// GREEN — the fix (drives the ACTUAL shipped functions)
// ===========================================================================
describe("GREEN — webhook event lifecycle (acquire / mark / poison / lease)", () => {
  let db: PGlite;
  let supabase: any;
  beforeAll(async () => { db = await buildFixedDb(); supabase = pgClient(db); });
  afterAll(async () => db.close());

  it("(a) a FAILED event is RECLAIMED on retry, and a PROCESSED event is skipped", async () => {
    const args = { provider: "paystack" as const, eventId: "evt_g1", eventType: "charge.success", payload: { x: 1 } };

    const first = await acquireWebhookEvent(supabase, args);
    expect(first).toEqual({ result: "acquired", attempts: 1 });

    // processing fails -> mark failed -> retry reprocesses (NOT dropped)
    await markWebhookFailed(supabase, "paystack", "evt_g1", "verify timeout");
    const retry = await acquireWebhookEvent(supabase, args);
    expect(retry).toEqual({ result: "acquired", attempts: 2 });

    // success -> mark processed -> further retries are skipped
    await markWebhookProcessed(supabase, "paystack", "evt_g1");
    const afterDone = await acquireWebhookEvent(supabase, args);
    expect(afterDone.result).toBe("duplicate_processed");
  });

  it("poison cap: after WEBHOOK_MAX_ATTEMPTS failures the event is marked dead", async () => {
    const args = { provider: "paystack" as const, eventId: "evt_poison", eventType: "charge.success", payload: null };
    for (let i = 1; i <= WEBHOOK_MAX_ATTEMPTS; i++) {
      const o = await acquireWebhookEvent(supabase, args);
      expect(o).toEqual({ result: "acquired", attempts: i });
      await markWebhookFailed(supabase, "paystack", "evt_poison", `fail ${i}`);
    }
    const dead = await acquireWebhookEvent(supabase, args);
    expect(dead.result).toBe("dead"); // stops reprocessing (no infinite churn)
  });

  it("lease: a fresh 'processing' row is in_flight; a stale one is reclaimable", async () => {
    const args = { provider: "flutterwave" as const, eventId: "evt_lease", eventType: "charge.completed", payload: null };

    expect((await acquireWebhookEvent(supabase, args)).result).toBe("acquired");
    // A concurrent delivery while the lease is fresh must NOT also process.
    expect((await acquireWebhookEvent(supabase, args)).result).toBe("in_flight");

    // Simulate the worker crashing: age the row past the 5-minute lease.
    await db.query(
      `UPDATE webhook_events SET updated_at = NOW() - interval '10 minutes'
       WHERE provider='flutterwave' AND event_id='evt_lease'`
    );
    const reclaimed = await acquireWebhookEvent(supabase, args);
    expect(reclaimed).toEqual({ result: "acquired", attempts: 2 });
  });
});

describe("GREEN (b) — appointment double-create guard converges on one row", () => {
  let db: PGlite;
  let supabase: any;
  const PAY = "44444444-4444-4444-4444-444444444444";
  const USER = "55555555-5555-5555-5555-555555555555";
  const BRANCH = "66666666-6666-6666-6666-666666666666";

  beforeAll(async () => {
    db = await buildFixedDb();
    supabase = pgClient(db);
    await db.exec(`
      INSERT INTO users (id) VALUES ('${USER}');
      INSERT INTO branches (id) VALUES ('${BRANCH}');
    `);
    await db.query(
      `INSERT INTO payments (id, user_id, amount, status, metadata, appointment_id)
       VALUES ('${PAY}','${USER}',500,'completed',$1::jsonb,NULL)`,
      [JSON.stringify({ appointment_data: { branch_id: BRANCH, appointment_date: "2026-08-01T10:00:00Z", treatment_type: "consultation" } })]
    );
  });
  afterAll(async () => db.close());

  it("two duplicate deliveries -> one appointment (unique guard), and a raw 2nd insert is rejected", async () => {
    // Both deliveries see payment.appointment_id = null (the concurrent case).
    const payment = {
      id: PAY, user_id: USER, status: "completed", appointment_id: null,
      metadata: { appointment_data: { branch_id: BRANCH, appointment_date: "2026-08-01T10:00:00Z", treatment_type: "consultation" } },
    };
    const a1 = await ensureAppointmentForCompletedPayment(supabase, payment);
    const a2 = await ensureAppointmentForCompletedPayment(supabase, { ...payment }); // duplicate delivery
    expect(a1.id).toBe(a2.id); // converged on the same appointment

    const count = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM appointments WHERE payment_id='${PAY}'`
    );
    expect(count.rows[0].n).toBe(1); // NOT double-booked

    // The DB constraint rejects a second appointment per payment regardless of timing.
    await expect(
      db.query(
        `INSERT INTO appointments (user_id, branch_id, appointment_date, treatment_type, status, payment_id)
         VALUES ('${USER}','${BRANCH}', NOW(), 'consultation', 'pending', '${PAY}')`
      )
    ).rejects.toThrow(/duplicate key value|unique/i);
  });
});
