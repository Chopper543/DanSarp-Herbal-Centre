/**
 * @jest-environment node
 *
 * GREEN — the /[id] clinical PUT handlers (missed by 908331f) now build their
 * write from an explicit allowlist, so appointment_id (and, for clinical-notes/[id],
 * note_type / is_template / template_id) never reach the write payload — the same
 * mis-attribution class, now closed on the /[id] routes too. Captures the payload
 * each handler builds and asserts the frozen fields are DROPPED while a legit field
 * edit still persists.
 */
export {}; // module scope

const DOCTOR = "11111111-1111-1111-1111-111111111111";
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
      b.update = (row: any) => { b.op = "update"; captured[`${table}:update`] = row; return b; };
      b.eq = () => b;
      b.single = () => b;
      b.then = (resolve: any) => {
        if (b.op === "update") return resolve({ data: { ...existingRow, ...captured[`${table}:update`] }, error: null });
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
}));
jest.mock("@/lib/utils/sanitize", () => ({ sanitizeText: (s: string) => s }));
jest.mock("@/lib/audit/phi-read", () => ({ logPhiRead: async () => undefined }));

function putReq(body: any, id: string) {
  return [
    { json: async () => body, headers: new Headers(), nextUrl: { pathname: `/api/x/${id}` } } as any,
    { params: Promise.resolve({ id }) },
  ] as const;
}

beforeEach(() => { for (const k of Object.keys(captured)) delete captured[k]; });

describe("GREEN — lab-results/[id] PUT drops appointment_id from the write", () => {
  it("appointment_id is dropped while a legit notes edit persists", async () => {
    existingRow = { id: REC, doctor_id: DOCTOR, patient_id: "p", appointment_id: APPT_A, status: "pending" };
    const { PUT } = await import("../app/api/lab-results/[id]/route");
    const [req, ctx] = putReq({ appointment_id: APPT_B, notes: "edit" }, REC);
    const res = await PUT(req, ctx);
    expect(res.status).toBe(200);
    const payload = captured["lab_results:update"];
    expect(payload.appointment_id).toBeUndefined(); // dropped — cannot re-target
    expect(payload.notes).toBe("edit");             // legit edit still applied
  });
});

describe("GREEN — clinical-notes/[id] PUT drops appointment_id + note_type + is_template + template_id", () => {
  it("frozen fields are dropped while a legit assessment edit persists", async () => {
    existingRow = {
      id: REC, doctor_id: DOCTOR, patient_id: "p", appointment_id: APPT_A,
      note_type: "soap", is_template: false,
    };
    const { PUT } = await import("../app/api/clinical-notes/[id]/route");
    const [req, ctx] = putReq(
      {
        appointment_id: APPT_B,
        note_type: "progress",
        is_template: true,
        template_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        assessment: "edit",
      },
      REC
    );
    const res = await PUT(req, ctx);
    expect(res.status).toBe(200);
    const payload = captured["clinical_notes:update"];
    expect(payload.appointment_id).toBeUndefined(); // dropped — encounter frozen
    expect(payload.note_type).toBeUndefined();       // dropped — classification frozen
    expect(payload.is_template).toBeUndefined();      // dropped — cannot hide as template
    expect(payload.template_id).toBeUndefined();      // dropped
    expect(payload.assessment).toBe("edit");          // legit edit still applied
  });
});
