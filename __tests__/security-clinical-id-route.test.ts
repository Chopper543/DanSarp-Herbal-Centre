/**
 * @jest-environment node
 *
 * GREEN — the lab-results/[id] PUT handler (missed by 908331f) now builds its
 * write from an explicit allowlist, so appointment_id never reaches the write
 * payload — the same mis-attribution class, now closed on this /[id] route too.
 * Captures the payload the handler builds and asserts the frozen field is DROPPED
 * while a legit field edit still persists.
 *
 * NOTE: clinical-notes/[id] PUT was REMOVED (dead in-place path — all note edits go
 * through the append-only amendment route, POST/PUT /api/clinical-notes; see
 * FIXES.md §5f). Its identity/classification freeze is now covered at the DB layer
 * by __tests__/security-clinical-immutable-trigger.dbtest.ts, so there is no /[id]
 * PUT for clinical-notes to assert here.
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
