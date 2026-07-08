/**
 * @jest-environment node
 *
 * DB-layer clinical immutability backstop — REAL Postgres (pglite/WASM).
 *
 * GREEN: with the identity-freeze triggers installed (migration
 * 20260708000001 / final_schema.sql), a direct UPDATE re-targeting patient_id /
 * appointment_id / doctor_id now RAISES on all three clinical tables, and an
 * amendment INSERT whose identity does not match its parent RAISES. These run on
 * the default (owner/superuser, RLS-bypassing) connection — i.e. the
 * service-role-equivalent path — so blocking the SAME ops here proves the trigger
 * binds bypassing writers, not just RLS-subject ones.
 *
 * The trigger FUNCTIONS are extracted verbatim from supabase/final_schema.sql (not
 * re-authored here), so this exercises the actual shipped SQL. The second suite is
 * the invisible-to-legit-writes backstop: every current legitimate write
 * (allowlist edit, soft-delete, supersede, refill decrement, matching re-pin)
 * MUST pass the guard unchanged — if any trips it, the trigger is too strict.
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
const RE_FREEZE_FN =
  /CREATE OR REPLACE FUNCTION clinical_records_freeze_identity\(\)[\s\S]*?\$\$;/;
const RE_AMEND_FN =
  /CREATE OR REPLACE FUNCTION clinical_notes_amendment_identity\(\)[\s\S]*?\$\$;/;

const A = "22222222-2222-2222-2222-222222222222"; // patient A
const B = "33333333-3333-3333-3333-333333333333"; // patient B (mis-attribution target)
const DOC = "11111111-1111-1111-1111-111111111111";
const DOC2 = "99999999-9999-9999-9999-999999999999";
const APPT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const APPT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const REC = "44444444-4444-4444-4444-444444444444";

/**
 * Minimal clinical tables carrying the identity columns the guard protects PLUS
 * the columns every legitimate mutation touches (status, refills_remaining,
 * version, superseded_by_id, deleted_*), so the invisible-to-legit-writes suite
 * exercises real edits — not just no-ops the trigger would ignore either way.
 */
async function buildTables(db: PGlite) {
  for (const t of ["prescriptions", "lab_results"]) {
    await db.exec(`
      CREATE TABLE ${t} (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL,
        doctor_id uuid NOT NULL,
        appointment_id uuid,
        doctor_notes text,
        status text,
        refills_remaining int
      );`);
  }
  await db.exec(`
    CREATE TABLE clinical_notes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id uuid NOT NULL,
      doctor_id uuid NOT NULL,
      appointment_id uuid,
      doctor_notes text,
      status text,
      amended_from_id uuid REFERENCES clinical_notes(id),
      is_amendment boolean NOT NULL DEFAULT false,
      superseded_by_id uuid,
      version int NOT NULL DEFAULT 1,
      deleted_at timestamptz,
      deleted_by uuid,
      deleted_reason text
    );`);
}

async function installGuards(db: PGlite) {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  await db.exec(extract(schema, RE_FREEZE_FN, "clinical_records_freeze_identity"));
  await db.exec(extract(schema, RE_AMEND_FN, "clinical_notes_amendment_identity"));
  await db.exec(`
    CREATE TRIGGER prescriptions_freeze_identity BEFORE UPDATE ON prescriptions
      FOR EACH ROW EXECUTE FUNCTION clinical_records_freeze_identity();
    CREATE TRIGGER lab_results_freeze_identity BEFORE UPDATE ON lab_results
      FOR EACH ROW EXECUTE FUNCTION clinical_records_freeze_identity();
    CREATE TRIGGER clinical_notes_freeze_identity BEFORE UPDATE ON clinical_notes
      FOR EACH ROW EXECUTE FUNCTION clinical_records_freeze_identity();
    CREATE TRIGGER clinical_notes_amendment_identity BEFORE INSERT ON clinical_notes
      FOR EACH ROW EXECUTE FUNCTION clinical_notes_amendment_identity();
  `);
}

async function buildDb(): Promise<PGlite> {
  const db = new PGlite();
  await buildTables(db);
  await installGuards(db);
  return db;
}

async function seed(db: PGlite, t: string) {
  await db.exec(
    `INSERT INTO ${t} (id, patient_id, doctor_id, appointment_id, doctor_notes, status)
     VALUES ('${REC}','${A}','${DOC}','${APPT_A}','orig','active')`
  );
}

describe("GREEN — DB guard: direct UPDATE re-targeting identity RAISES on all three tables", () => {
  it("prescriptions: patient_id A -> B is rejected", async () => {
    const db = await buildDb();
    await seed(db, "prescriptions");
    await expect(
      db.query(`UPDATE prescriptions SET patient_id='${B}' WHERE id='${REC}'`)
    ).rejects.toThrow(/immutable: patient_id/);
    const r = (await db.query<any>(`SELECT patient_id FROM prescriptions WHERE id='${REC}'`)).rows[0];
    expect(r.patient_id).toBe(A); // unchanged — the write was blocked
    await db.close();
  });

  it("lab_results: appointment_id A -> B is rejected", async () => {
    const db = await buildDb();
    await seed(db, "lab_results");
    await expect(
      db.query(`UPDATE lab_results SET appointment_id='${APPT_B}' WHERE id='${REC}'`)
    ).rejects.toThrow(/immutable: appointment_id/);
    const r = (await db.query<any>(`SELECT appointment_id FROM lab_results WHERE id='${REC}'`)).rows[0];
    expect(r.appointment_id).toBe(APPT_A);
    await db.close();
  });

  it("clinical_notes: doctor_id re-assign is rejected", async () => {
    const db = await buildDb();
    await seed(db, "clinical_notes");
    await expect(
      db.query(`UPDATE clinical_notes SET doctor_id='${DOC2}' WHERE id='${REC}'`)
    ).rejects.toThrow(/immutable: doctor_id/);
    const r = (await db.query<any>(`SELECT doctor_id FROM clinical_notes WHERE id='${REC}'`)).rows[0];
    expect(r.doctor_id).toBe(DOC);
    await db.close();
  });

  it("an identity-freeze trigger now exists on each of the three tables", async () => {
    const db = await buildDb();
    const rows = (await db.query<any>(
      `SELECT c.relname, t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
       WHERE c.relname IN ('prescriptions','lab_results','clinical_notes')
         AND NOT t.tgisinternal AND t.tgname LIKE '%freeze_identity'`
    )).rows;
    const tables = new Set(rows.map((r: any) => r.relname));
    expect(tables).toEqual(new Set(["prescriptions", "lab_results", "clinical_notes"]));
    await db.close();
  });
});

describe("GREEN — INSERT guard: amendment identity must match its parent", () => {
  it("an amendment with a patient_id different from its parent is rejected", async () => {
    const db = await buildDb();
    await seed(db, "clinical_notes"); // parent: patient A
    const NEW = "55555555-5555-5555-5555-555555555555";
    await expect(
      db.query(
        `INSERT INTO clinical_notes (id, patient_id, doctor_id, appointment_id, doctor_notes, amended_from_id, is_amendment)
         VALUES ('${NEW}','${B}','${DOC}','${APPT_A}','amended','${REC}', true)`
      )
    ).rejects.toThrow(/amendment identity must match parent/);
    const n = (await db.query<any>(`SELECT count(*)::int AS c FROM clinical_notes WHERE id='${NEW}'`)).rows[0];
    expect(n.c).toBe(0); // never landed
    await db.close();
  });

  it("a MATCHING amendment (identity re-pinned to the parent's) is accepted", async () => {
    const db = await buildDb();
    await seed(db, "clinical_notes"); // parent: patient A, DOC, APPT_A
    const NEW = "55555555-5555-5555-5555-555555555555";
    // The 908331f re-pin: NEW.{patient_id,appointment_id,doctor_id} = parent's.
    await db.query(
      `INSERT INTO clinical_notes (id, patient_id, doctor_id, appointment_id, doctor_notes, amended_from_id, is_amendment, version)
       VALUES ('${NEW}','${A}','${DOC}','${APPT_A}','amended','${REC}', true, 2)`
    );
    const r = (await db.query<any>(`SELECT patient_id, version FROM clinical_notes WHERE id='${NEW}'`)).rows[0];
    expect(r.patient_id).toBe(A);
    expect(r.version).toBe(2);
    await db.close();
  });

  it("a create-INSERT (amended_from_id NULL) establishes identity freely", async () => {
    const db = await buildDb();
    const NEW = "66666666-6666-6666-6666-666666666666";
    await db.query(
      `INSERT INTO clinical_notes (id, patient_id, doctor_id, appointment_id, doctor_notes)
       VALUES ('${NEW}','${A}','${DOC}','${APPT_A}','fresh note')`
    );
    const r = (await db.query<any>(`SELECT patient_id FROM clinical_notes WHERE id='${NEW}'`)).rows[0];
    expect(r.patient_id).toBe(A);
    await db.close();
  });
});

describe("GREEN — invisible to legit writes: every legitimate mutation passes the guard unchanged", () => {
  it("908331f allowlist edit (doctor_notes + status, identity untouched) is accepted", async () => {
    const db = await buildDb();
    await seed(db, "prescriptions");
    await db.query(
      `UPDATE prescriptions SET doctor_notes='revised', status='completed' WHERE id='${REC}'`
    );
    const r = (await db.query<any>(`SELECT doctor_notes, status, patient_id FROM prescriptions WHERE id='${REC}'`)).rows[0];
    expect(r.doctor_notes).toBe("revised");
    expect(r.status).toBe("completed");
    expect(r.patient_id).toBe(A); // identity preserved
    await db.close();
  });

  it("soft-delete (deleted_at/deleted_by/deleted_reason) is accepted", async () => {
    const db = await buildDb();
    await seed(db, "clinical_notes");
    await db.query(
      `UPDATE clinical_notes SET deleted_at=now(), deleted_by='${DOC}', deleted_reason='entered in error' WHERE id='${REC}'`
    );
    const r = (await db.query<any>(`SELECT deleted_at, deleted_reason FROM clinical_notes WHERE id='${REC}'`)).rows[0];
    expect(r.deleted_at).not.toBeNull();
    expect(r.deleted_reason).toBe("entered in error");
    await db.close();
  });

  it("supersede (superseded_by_id + version bump on the parent) is accepted", async () => {
    const db = await buildDb();
    await seed(db, "clinical_notes");
    const NEW = "77777777-7777-7777-7777-777777777777";
    await db.query(
      `UPDATE clinical_notes SET superseded_by_id='${NEW}', version=2 WHERE id='${REC}'`
    );
    const r = (await db.query<any>(`SELECT superseded_by_id, version FROM clinical_notes WHERE id='${REC}'`)).rows[0];
    expect(r.superseded_by_id).toBe(NEW);
    expect(r.version).toBe(2);
    await db.close();
  });

  it("refill decrement (refills_remaining - 1) is accepted", async () => {
    const db = await buildDb();
    await db.exec(
      `INSERT INTO prescriptions (id, patient_id, doctor_id, appointment_id, doctor_notes, status, refills_remaining)
       VALUES ('${REC}','${A}','${DOC}','${APPT_A}','orig','active', 3)`
    );
    await db.query(`UPDATE prescriptions SET refills_remaining = refills_remaining - 1 WHERE id='${REC}'`);
    const r = (await db.query<any>(`SELECT refills_remaining FROM prescriptions WHERE id='${REC}'`)).rows[0];
    expect(r.refills_remaining).toBe(2);
    await db.close();
  });

  it("a no-op re-send of the SAME identity values is accepted (edit forms resend unchanged ids)", async () => {
    const db = await buildDb();
    await seed(db, "lab_results");
    // Edit form resends patient_id/appointment_id unchanged alongside a real edit.
    await db.query(
      `UPDATE lab_results SET patient_id='${A}', appointment_id='${APPT_A}', doctor_notes='edited' WHERE id='${REC}'`
    );
    const r = (await db.query<any>(`SELECT doctor_notes FROM lab_results WHERE id='${REC}'`)).rows[0];
    expect(r.doctor_notes).toBe("edited");
    await db.close();
  });
});
