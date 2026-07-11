/**
 * @jest-environment node
 *
 * DB-layer clinical DELETE-block backstop — REAL Postgres (pglite/WASM).
 *
 * This is the DELETE analog of security-clinical-immutable-trigger.dbtest.ts.
 * fix/clinical-notes-soft-delete-id moved the APP delete path to soft-delete, but
 * RLS `notes_delete_admin` / `lab_delete_admin` still permit a physical DELETE, and
 * a service-role / table-owner writer bypasses RLS entirely — nothing bound a
 * bypassing writer to the retention model. GREEN adds `clinical_records_block_delete()`
 * BEFORE DELETE on clinical_notes + prescriptions plus a gated
 * `purge_patient_clinical_data()` SECURITY DEFINER RPC for the live
 * right-to-be-forgotten cron.
 *
 * These run on the default (owner/superuser, RLS-bypassing) connection — i.e. the
 * service-role-equivalent path the cron uses — so blocking the SAME ops here proves
 * the trigger binds bypassing writers, not just RLS-subject ones.
 *
 * The trigger + RPC FUNCTIONS are extracted verbatim from supabase/final_schema.sql
 * (not re-authored here), so this exercises the actual shipped SQL.
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

const SCHEMA_PATH = path.join(process.cwd(), "supabase/final_schema.sql");
function extract(sql: string, re: RegExp, label: string): string {
  const m = sql.match(re);
  if (!m) throw new Error(`Could not extract ${label}`);
  return m[0];
}
const RE_BLOCK_FN =
  /CREATE OR REPLACE FUNCTION clinical_records_block_delete\(\)[\s\S]*?\$\$;/;
const RE_PURGE_FN =
  /CREATE OR REPLACE FUNCTION purge_patient_clinical_data\(p_user_id UUID\)[\s\S]*?\$\$;/;

const A = "22222222-2222-2222-2222-222222222222"; // patient A (erasure target)
const B = "33333333-3333-3333-3333-333333333333"; // patient B (must survive A's purge)
const DOC = "11111111-1111-1111-1111-111111111111";
const APPT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const NOTE = "44444444-4444-4444-4444-444444444444";
const RX = "55555555-5555-5555-5555-555555555555";
const LAB = "66666666-6666-6666-6666-666666666666";

/**
 * Minimal clinical tables + deletion_requests, matching the columns
 * final_schema.sql defines that this backstop touches. clinical_notes and
 * prescriptions get the block trigger; lab_results does NOT (deferred — it still
 * has live physical-delete admin handlers and no soft-delete columns), but the
 * purge RPC deletes it too, so it is present here.
 */
async function buildTables(db: PGlite) {
  for (const t of ["prescriptions", "lab_results"]) {
    await db.exec(`
      CREATE TABLE ${t} (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL,
        doctor_id uuid NOT NULL,
        appointment_id uuid,
        status text
      );`);
  }
  await db.exec(`
    CREATE TABLE clinical_notes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id uuid NOT NULL,
      doctor_id uuid NOT NULL,
      appointment_id uuid,
      status text,
      deleted_at timestamptz,
      deleted_by uuid,
      deleted_reason text
    );`);
  await db.exec(`
    CREATE TABLE deletion_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      status text NOT NULL DEFAULT 'pending'
    );`);
}

async function installGuards(db: PGlite) {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  await db.exec(extract(schema, RE_BLOCK_FN, "clinical_records_block_delete"));
  await db.exec(extract(schema, RE_PURGE_FN, "purge_patient_clinical_data"));
  await db.exec(`
    CREATE TRIGGER clinical_notes_block_delete BEFORE DELETE ON clinical_notes
      FOR EACH ROW EXECUTE FUNCTION clinical_records_block_delete();
    CREATE TRIGGER prescriptions_block_delete BEFORE DELETE ON prescriptions
      FOR EACH ROW EXECUTE FUNCTION clinical_records_block_delete();
  `);
}

async function buildDb(): Promise<PGlite> {
  const db = new PGlite();
  await buildTables(db);
  await installGuards(db);
  return db;
}

async function seedClinical(db: PGlite, patient: string, ids: { note?: string; rx?: string; lab?: string }) {
  if (ids.note)
    await db.exec(`INSERT INTO clinical_notes (id, patient_id, doctor_id, appointment_id, status)
      VALUES ('${ids.note}','${patient}','${DOC}','${APPT_A}','active')`);
  if (ids.rx)
    await db.exec(`INSERT INTO prescriptions (id, patient_id, doctor_id, appointment_id, status)
      VALUES ('${ids.rx}','${patient}','${DOC}','${APPT_A}','active')`);
  if (ids.lab)
    await db.exec(`INSERT INTO lab_results (id, patient_id, doctor_id, appointment_id, status)
      VALUES ('${ids.lab}','${patient}','${DOC}','${APPT_A}','pending')`);
}

async function count(db: PGlite, table: string, patient: string): Promise<number> {
  return (
    await db.query<any>(`SELECT count(*)::int AS c FROM ${table} WHERE patient_id='${patient}'`)
  ).rows[0].c;
}

describe("GREEN — BLOCK: physical DELETE on clinical records is rejected on the bypassing connection", () => {
  it("clinical_notes: a direct physical DELETE RAISES and the row survives", async () => {
    const db = await buildDb();
    await seedClinical(db, A, { note: NOTE });
    await expect(
      db.query(`DELETE FROM clinical_notes WHERE id='${NOTE}'`)
    ).rejects.toThrow(/cannot be physically deleted/);
    expect(await count(db, "clinical_notes", A)).toBe(1); // retained
    await db.close();
  });

  it("prescriptions: a direct physical DELETE RAISES and the row survives", async () => {
    const db = await buildDb();
    await seedClinical(db, A, { rx: RX });
    await expect(
      db.query(`DELETE FROM prescriptions WHERE id='${RX}'`)
    ).rejects.toThrow(/cannot be physically deleted/);
    expect(await count(db, "prescriptions", A)).toBe(1); // retained
    await db.close();
  });

  it("a block-delete trigger now exists on clinical_notes AND prescriptions", async () => {
    const db = await buildDb();
    const rows = (
      await db.query<any>(
        `SELECT c.relname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
         WHERE c.relname IN ('clinical_notes','prescriptions')
           AND NOT t.tgisinternal AND t.tgname LIKE '%block_delete'`
      )
    ).rows;
    expect(new Set(rows.map((r: any) => r.relname))).toEqual(
      new Set(["clinical_notes", "prescriptions"])
    );
    await db.close();
  });
});

describe("GREEN — PIPELINE-STILL-WORKS: the erasure cron still purges THROUGH the block via the RPC", () => {
  it("purge_patient_clinical_data wipes A's rows across all three tables, leaves B untouched", async () => {
    const db = await buildDb();
    // The cron flips the request to 'processing' before it purges (route.ts:32-38).
    await db.exec(`INSERT INTO deletion_requests (user_id, status) VALUES ('${A}','processing')`);
    await seedClinical(db, A, { note: NOTE, rx: RX, lab: LAB });
    await seedClinical(db, B, {
      note: "44444444-4444-4444-4444-4444444444bb",
      rx: "55555555-5555-5555-5555-5555555555bb",
      lab: "66666666-6666-6666-6666-6666666666bb",
    });

    // The exact call the rewired cron now makes.
    await db.query(`SELECT purge_patient_clinical_data('${A}')`);

    expect(await count(db, "clinical_notes", A)).toBe(0);
    expect(await count(db, "prescriptions", A)).toBe(0);
    expect(await count(db, "lab_results", A)).toBe(0); // erased too (no block trigger yet)
    // B is collateral-free.
    expect(await count(db, "clinical_notes", B)).toBe(1);
    expect(await count(db, "prescriptions", B)).toBe(1);
    expect(await count(db, "lab_results", B)).toBe(1);
    await db.close();
  });
});

describe("GREEN — HATCH-GATED: the RPC refuses to purge a user with no live erasure request", () => {
  it("purge_patient_clinical_data RAISES when no pending/processing deletion_request exists", async () => {
    const db = await buildDb();
    await seedClinical(db, A, { note: NOTE, rx: RX, lab: LAB });
    // No deletion_requests row for A at all.
    await expect(
      db.query(`SELECT purge_patient_clinical_data('${A}')`)
    ).rejects.toThrow(/no pending\/processing deletion_request/);
    // Nothing was deleted — the guard fired before any DELETE.
    expect(await count(db, "clinical_notes", A)).toBe(1);
    expect(await count(db, "prescriptions", A)).toBe(1);
    expect(await count(db, "lab_results", A)).toBe(1);
    await db.close();
  });

  it("a completed (already-processed) request does NOT re-open the hatch", async () => {
    const db = await buildDb();
    await db.exec(`INSERT INTO deletion_requests (user_id, status) VALUES ('${A}','completed')`);
    await seedClinical(db, A, { note: NOTE });
    await expect(
      db.query(`SELECT purge_patient_clinical_data('${A}')`)
    ).rejects.toThrow(/no pending\/processing deletion_request/);
    expect(await count(db, "clinical_notes", A)).toBe(1);
    await db.close();
  });
});

describe("GREEN — FLAG-DOESN'T-LEAK: the purge flag is transaction-local, the hatch closes behind itself", () => {
  it("a raw DELETE after a successful purge RPC in the SAME session is STILL blocked", async () => {
    const db = await buildDb();
    await db.exec(`INSERT INTO deletion_requests (user_id, status) VALUES ('${A}','processing')`);
    await seedClinical(db, A, { note: NOTE });
    await seedClinical(db, B, { note: "44444444-4444-4444-4444-4444444444bb" });

    // 1) Legit purge for A — succeeds, sets the flag for its own transaction only.
    await db.query(`SELECT purge_patient_clinical_data('${A}')`);
    expect(await count(db, "clinical_notes", A)).toBe(0);

    // 2) A raw DELETE for B in a later statement must still hit the block — the
    //    flag did not survive the RPC's transaction.
    await expect(
      db.query(`DELETE FROM clinical_notes WHERE patient_id='${B}'`)
    ).rejects.toThrow(/cannot be physically deleted/);
    expect(await count(db, "clinical_notes", B)).toBe(1); // B retained — door closed
    await db.close();
  });
});

describe("GREEN — INVISIBLE-TO-LEGIT: the block is DELETE-only; legitimate soft-delete UPDATE still passes", () => {
  it("soft-delete UPDATE (deleted_at/deleted_by/deleted_reason) on clinical_notes is accepted", async () => {
    const db = await buildDb();
    await seedClinical(db, A, { note: NOTE });
    await db.query(
      `UPDATE clinical_notes SET deleted_at=now(), deleted_by='${DOC}', deleted_reason='entered in error' WHERE id='${NOTE}'`
    );
    const r = (
      await db.query<any>(`SELECT deleted_at, deleted_reason FROM clinical_notes WHERE id='${NOTE}'`)
    ).rows[0];
    expect(r.deleted_at).not.toBeNull();
    expect(r.deleted_reason).toBe("entered in error");
    expect(await count(db, "clinical_notes", A)).toBe(1); // still there, just flagged
    await db.close();
  });
});
