/**
 * @jest-environment node
 *
 * GREEN — route-level proof that the clinical PUT/amendment handlers no longer let
 * a client mutate patient_id / appointment_id (and other frozen fields). Mocks the
 * Supabase client to CAPTURE the exact payload each handler writes, then asserts:
 *   - immutable fields (patient_id, appointment_id, ...) are absent / re-pinned to
 *     the original, and
 *   - a legit mutable-field edit still persists.
 * The DB-level mis-attribution + RLS gap is proven in
 * __tests__/security-clinical-patient-immutable.dbtest.ts.
 */
export {}; // module scope

const DOCTOR = "11111111-1111-1111-1111-111111111111";
const PATIENT_A = "22222222-2222-2222-2222-222222222222";
const PATIENT_B = "33333333-3333-3333-3333-333333333333";
const APPT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const APPT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const REC = "44444444-4444-4444-4444-444444444444";

const captured: Record<string, any> = {};
let existingRow: any = {};

jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: DOCTOR } } }) },
    from(table: string) {
      const b: any = { table, op: null };
      b.select = () => b;
      b.insert = (row: any) => { b.op = "insert"; captured[`${table}:insert`] = row; return b; };
      b.update = (row: any) => { b.op = "update"; captured[`${table}:update`] = row; return b; };
      b.eq = () => b;
      b.single = () => b;
      b.maybeSingle = () => b;
      b.then = (resolve: any) => {
        if (b.op === "insert") return resolve({ data: { id: "new-id", ...captured[`${table}:insert`] }, error: null });
        if (b.op === "update") return resolve({ data: { ...existingRow, ...captured[`${table}:update`] }, error: null });
        if (table === "users") return resolve({ data: { full_name: "P", email: null, phone: null }, error: null });
        return resolve({ data: existingRow, error: null });
      };
      return b;
    },
  }),
}));
jest.mock("@/lib/auth/rbac", () => ({
  getUserRole: async () => "doctor",
  isDoctor: (r: string) => r === "doctor",
  isNurse: (r: string) => r === "nurse",
  isAdmin: (r: string) => r === "super_admin" || r === "admin",
}));
jest.mock("@/lib/utils/sanitize", () => ({ sanitizeText: (s: string) => s })); // avoid jsdom ESM load
jest.mock("@/lib/audit/log", () => ({ logAuditEvent: async () => undefined }));
jest.mock("@/lib/email/resend", () => ({ sendEmail: async () => undefined }));
jest.mock("@/lib/whatsapp/twilio", () => ({ sendWhatsAppMessage: async () => undefined }));

function putReq(body: any) {
  return {
    json: async () => body,
    headers: new Headers({ "user-agent": "jest" }),
    nextUrl: { pathname: "/api/x" },
  } as any;
}

beforeEach(() => {
  for (const k of Object.keys(captured)) delete captured[k];
});

describe("prescriptions PUT — patient_id/appointment_id/refills_original are NOT writable", () => {
  it("drops immutable fields, keeps the doctor_notes edit", async () => {
    existingRow = { id: REC, doctor_id: DOCTOR, patient_id: PATIENT_A, appointment_id: APPT_A, status: "active" };
    const { PUT } = await import("../app/api/prescriptions/route");
    const res = await PUT(putReq({
      id: REC, patient_id: PATIENT_B, appointment_id: APPT_B,
      refills_original: 5, doctor_notes: "edited by test", status: "active",
    }));
    expect(res.status).toBe(200);
    const payload = captured["prescriptions:update"];
    expect(payload).toBeDefined();
    expect("patient_id" in payload).toBe(false);
    expect("appointment_id" in payload).toBe(false);
    expect("refills_original" in payload).toBe(false);
    expect(payload.doctor_notes).toBe("edited by test"); // mutable edit persists
    expect(payload.status).toBe("active");
  });
});

describe("lab-results PUT — patient_id/appointment_id are NOT writable", () => {
  it("drops immutable fields, keeps the notes edit", async () => {
    existingRow = { id: REC, doctor_id: DOCTOR, patient_id: PATIENT_A, appointment_id: APPT_A, status: "pending", test_name: "CBC" };
    const { PUT } = await import("../app/api/lab-results/route");
    const res = await PUT(putReq({
      id: REC, patient_id: PATIENT_B, appointment_id: APPT_B,
      notes: "lab edit by test", status: "pending",
    }));
    expect(res.status).toBe(200);
    const payload = captured["lab_results:update"];
    expect(payload).toBeDefined();
    expect("patient_id" in payload).toBe(false);
    expect("appointment_id" in payload).toBe(false);
    expect(payload.notes).toBe("lab edit by test"); // mutable edit persists
  });
});

describe("clinical-notes amendment — provenance re-pinned, classification frozen", () => {
  it("re-pins patient_id/appointment_id/doctor_id from the original, keeps the assessment edit, freezes note_type/is_template", async () => {
    existingRow = {
      id: REC, doctor_id: DOCTOR, patient_id: PATIENT_A, appointment_id: APPT_A,
      note_type: "soap", is_template: false, template_id: null,
      subjective: "s", objective: "o", assessment: "old assessment", plan: "p",
      version: 1, superseded_by_id: null, deleted_at: null,
      created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    };
    const { PUT } = await import("../app/api/clinical-notes/route");
    const res = await PUT(putReq({
      id: REC, patient_id: PATIENT_B, appointment_id: APPT_B,
      is_template: true, note_type: "progress",
      assessment: "new assessment", amended_reason: "typo",
    }));
    expect(res.status).toBe(200);
    const row = captured["clinical_notes:insert"];
    expect(row).toBeDefined();
    // Provenance RE-PINNED from the original (NOT the client's patient B / appt B):
    expect(row.patient_id).toBe(PATIENT_A);
    expect(row.appointment_id).toBe(APPT_A);
    expect(row.doctor_id).toBe(DOCTOR);
    // Classification FROZEN (carried from original, client's values ignored):
    expect(row.note_type).toBe("soap");
    expect(row.is_template).toBe(false);
    // Mutable clinical edit persists:
    expect(row.assessment).toBe("new assessment");
    expect(row.is_amendment).toBe(true);
    expect(row.amended_from_id).toBe(REC);
  });
});
