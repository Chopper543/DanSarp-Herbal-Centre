/**
 * @jest-environment node
 *
 * Clinical record mis-attribution — REAL Postgres (pglite/WASM) with the ACTUAL
 * clinical RLS policies + helper functions, not mocks.
 *
 * RED: proves that today a PUT/amendment carrying a mutated patient_id (and
 * appointment_id) RE-TARGETS the clinical record from patient A to patient B, and
 * that the real RLS policy does NOT catch it (confirming Q4 — the app handler is
 * the only line of defense). For clinical notes it also shows the amendment's
 * `{...preserved, ...updateData}` spread lets updateData override preserved
 * provenance.
 *
 * The UPDATE/INSERT statements here are the SQL the current spread-based handlers
 * produce (payload includes patient_id/appointment_id). RLS is exercised for real
 * by running them as the authenticated owning-doctor role.
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
const RE_CLINICAL_FN = /CREATE OR REPLACE FUNCTION is_clinical_staff_user\(\)[\s\S]*?\$\$;/;
const RE_RX_FN = /CREATE OR REPLACE FUNCTION is_prescriptions_staff_user\(\)[\s\S]*?\$\$;/;
const RE_RX_SELECT = /CREATE POLICY rx_select_patient_doctor ON prescriptions[\s\S]*?;/;
const RE_LAB_SELECT = /CREATE POLICY lab_select ON lab_results[\s\S]*?;/;
const RE_NOTES_SELECT = /CREATE POLICY notes_select ON clinical_notes[\s\S]*?;/;
const RE_RX_UPDATE = /CREATE POLICY rx_update_doc_admin ON prescriptions[\s\S]*?;/;
const RE_LAB_UPDATE = /CREATE POLICY lab_update ON lab_results[\s\S]*?;/;
const RE_NOTES_UPDATE = /CREATE POLICY notes_update ON clinical_notes[\s\S]*?;/;
const RE_NOTES_INSERT = /CREATE POLICY notes_insert ON clinical_notes[\s\S]*?;/;

const DOCTOR = "11111111-1111-1111-1111-111111111111";
const PATIENT_A = "22222222-2222-2222-2222-222222222222";
const PATIENT_B = "33333333-3333-3333-3333-333333333333"; // the mis-attribution target
const APPT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const APPT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const REC = "44444444-4444-4444-4444-444444444444";

/**
 * Minimal-but-faithful clinical tables carrying exactly the columns the real RLS
 * policies depend on (patient_id, doctor_id) + a mutable field + provenance. The
 * REAL policy statements and REAL helper functions are applied verbatim, so RLS
 * behaviour is faithful.
 */
async function buildDb(): Promise<PGlite> {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  const db = new PGlite();
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE ROLE authenticated NOLOGIN;
    GRANT USAGE ON SCHEMA auth, extensions TO authenticated;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
    CREATE TABLE users (id uuid PRIMARY KEY, role text NOT NULL DEFAULT 'user');
  `);
  await db.exec(extract(schema, RE_CLINICAL_FN, "is_clinical_staff_user"));
  await db.exec(extract(schema, RE_RX_FN, "is_prescriptions_staff_user"));

  for (const t of ["prescriptions", "lab_results", "clinical_notes"]) {
    await db.exec(`
      CREATE TABLE ${t} (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id uuid NOT NULL,
        doctor_id uuid NOT NULL,
        appointment_id uuid,
        doctor_notes text,
        created_by uuid,
        superseded_by_id uuid,
        amended_from_id uuid
      );
      ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;
      GRANT SELECT, INSERT, UPDATE ON ${t} TO authenticated;
    `);
  }
  await db.exec(extract(schema, RE_RX_SELECT, "rx_select policy"));
  await db.exec(extract(schema, RE_LAB_SELECT, "lab_select policy"));
  await db.exec(extract(schema, RE_NOTES_SELECT, "notes_select policy"));
  await db.exec(extract(schema, RE_RX_UPDATE, "rx_update policy"));
  await db.exec(extract(schema, RE_LAB_UPDATE, "lab_update policy"));
  await db.exec(extract(schema, RE_NOTES_UPDATE, "notes_update policy"));
  await db.exec(extract(schema, RE_NOTES_INSERT, "notes_insert policy"));

  await db.exec(`
    INSERT INTO users (id, role) VALUES
      ('${DOCTOR}', 'doctor'), ('${PATIENT_A}', 'user'), ('${PATIENT_B}', 'user');
  `);
  return db;
}

/** Run fn as the authenticated owning doctor (jwt sub = doctor). */
async function asDoctor<T>(db: PGlite, fn: () => Promise<T>): Promise<T> {
  await db.exec("BEGIN");
  try {
    await db.exec("SET LOCAL ROLE authenticated");
    await db.query("SELECT set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: DOCTOR }),
    ]);
    const r = await fn();
    await db.exec("COMMIT");
    return r;
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  }
}

async function seedRecord(db: PGlite, table: string) {
  await db.exec(
    `INSERT INTO ${table} (id, patient_id, doctor_id, appointment_id, doctor_notes, created_by)
     VALUES ('${REC}','${PATIENT_A}','${DOCTOR}','${APPT_A}','original', '${DOCTOR}')`
  );
}

describe("RED — prescriptions PUT re-targets patient_id (RLS does NOT catch it)", () => {
  let db: PGlite;
  beforeAll(async () => { db = await buildDb(); await seedRecord(db, "prescriptions"); });
  afterAll(async () => db.close());

  it("the current spread UPDATE moves the prescription from patient A to patient B", async () => {
    // What the current handler produces: payload spreads updateData incl. patient_id.
    await asDoctor(db, () =>
      db.query(
        `UPDATE prescriptions SET patient_id='${PATIENT_B}', appointment_id='${APPT_B}', doctor_notes='edited' WHERE id='${REC}'`
      )
    );
    const row = (await db.query<any>(`SELECT patient_id, appointment_id FROM prescriptions WHERE id='${REC}'`)).rows[0];
    expect(row.patient_id).toBe(PATIENT_B);   // re-targeted — mis-attributed
    expect(row.appointment_id).toBe(APPT_B);  // encounter provenance broken too
    // and RLS allowed it: the update did not raise.
  });
});

describe("RED — lab_results PUT re-targets patient_id (RLS does NOT catch it)", () => {
  let db: PGlite;
  beforeAll(async () => { db = await buildDb(); await seedRecord(db, "lab_results"); });
  afterAll(async () => db.close());

  it("the current spread UPDATE moves the lab result from patient A to patient B", async () => {
    await asDoctor(db, () =>
      db.query(
        `UPDATE lab_results SET patient_id='${PATIENT_B}', appointment_id='${APPT_B}', doctor_notes='edited' WHERE id='${REC}'`
      )
    );
    const row = (await db.query<any>(`SELECT patient_id, appointment_id FROM lab_results WHERE id='${REC}'`)).rows[0];
    expect(row.patient_id).toBe(PATIENT_B);
    expect(row.appointment_id).toBe(APPT_B);
  });
});

describe("RED — clinical_notes amendment re-targets patient_id (RLS does NOT catch it)", () => {
  let db: PGlite;
  beforeAll(async () => { db = await buildDb(); await seedRecord(db, "clinical_notes"); });
  afterAll(async () => db.close());

  it("the amendment INSERT with a mutated patient_id lands under RLS", async () => {
    // The amendment is an INSERT of a new version. The current amendmentRow spreads
    // updateData over preservedFields, so patient_id=B propagates into the new row.
    const NEW = "55555555-5555-5555-5555-555555555555";
    await asDoctor(db, () =>
      db.query(
        `INSERT INTO clinical_notes (id, patient_id, doctor_id, appointment_id, doctor_notes, amended_from_id)
         VALUES ('${NEW}','${PATIENT_B}','${DOCTOR}','${APPT_B}','amended', '${REC}')`
      )
    );
    const row = (await db.query<any>(`SELECT patient_id, appointment_id FROM clinical_notes WHERE id='${NEW}'`)).rows[0];
    expect(row.patient_id).toBe(PATIENT_B); // amended version attributed to patient B
    expect(row.appointment_id).toBe(APPT_B);
  });

  it("the {...preserved, ...updateData} spread lets updateData OVERRIDE preserved provenance", async () => {
    // Mirrors clinical-notes/route.ts:374-375 (amendmentRow = { ...preservedFields, ...updateData }).
    const preservedFields = { patient_id: PATIENT_A, appointment_id: APPT_A, doctor_id: DOCTOR };
    const updateData: any = { patient_id: PATIENT_B, appointment_id: APPT_B, plan: "new plan" };
    const amendmentRow = { ...preservedFields, ...updateData };
    expect(amendmentRow.patient_id).toBe(PATIENT_B);     // overridden — provenance lost
    expect(amendmentRow.appointment_id).toBe(APPT_B);
  });
});
