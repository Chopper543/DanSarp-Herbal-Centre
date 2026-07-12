/**
 * @jest-environment node
 *
 * GREEN — DELETE /api/clinical-notes/[id] now SOFT-deletes, reusing the proven
 * collection-path logic: existence check (404), already-deleted guard (409),
 * UPDATE deleted_at/deleted_by/sanitize(deleted_reason), and an audit event
 * (action='delete_clinical_note', soft_delete:true). Admin-only preserved.
 *
 * Proves BOTH halves the retention model needs:
 *   - the row is RETAINED (a soft-delete UPDATE, never a physical `.delete()`), and
 *   - the destruction is AUDITED (logAuditEvent fires with soft_delete:true).
 *
 * The Supabase client is mocked to record which write op the handler performs
 * (delete vs update) and to capture the soft-delete payload; `logAuditEvent` is a
 * spy. (Was RED: proved the old handler physically destroyed the row and never
 * audited — see the hard-delete item in FIXES.md.)
 */
export {}; // module scope

const ADMIN = "11111111-1111-1111-1111-111111111111";
const PATIENT = "22222222-2222-2222-2222-222222222222";
const DOCTOR = "99999999-9999-9999-9999-999999999999";
const REC = "44444444-4444-4444-4444-444444444444";

const captured: { delete: boolean; update: any } = { delete: false, update: undefined };
let existingRow: any = {};

const mockAudit = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: ADMIN } } }) },
    from(table: string) {
      const b: any = { op: null, _single: false };
      b.select = () => b;
      b.eq = () => b;
      b.is = () => b;
      b.order = () => b;
      b.range = () => b;
      b.delete = () => { b.op = "delete"; captured.delete = true; return b; };
      b.update = (row: any) => { b.op = "update"; captured.update = row; return b; };
      b.single = () => { b._single = true; return b; };
      b.then = (resolve: any) => {
        if (b.op === "delete") return resolve({ data: null, error: null });
        if (b.op === "update") return resolve({ data: { ...existingRow, ...captured.update }, error: null });
        return resolve({ data: existingRow, error: existingRow ? null : { code: "PGRST116" } });
      };
      return b;
    },
  }),
}));
jest.mock("@/lib/auth/rbac", () => ({ getUserRole: async () => "admin", isDoctor: (r: string) => r === "doctor" }));
jest.mock("@/lib/auth/role-capabilities", () => ({ canAccessSection: () => true }));
jest.mock("@/lib/utils/sanitize", () => ({ sanitizeText: (s: string) => s }));
jest.mock("@/lib/audit/phi-read", () => ({ logPhiRead: async () => undefined }));
jest.mock("@/lib/audit/log", () => ({ logAuditEvent: (...a: any[]) => mockAudit(...a) }));

function delReq(id: string, reason?: string) {
  const url = `http://x/api/clinical-notes/${id}${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`;
  return [
    { headers: new Headers(), nextUrl: { pathname: `/api/clinical-notes/${id}` }, url } as any,
    { params: Promise.resolve({ id }) },
  ] as const;
}

beforeEach(() => {
  captured.delete = false;
  captured.update = undefined;
  mockAudit.mockClear();
  existingRow = {
    id: REC, patient_id: PATIENT, doctor_id: DOCTOR,
    subjective: "s", objective: "o", assessment: "a", plan: "p",
    deleted_at: null, deleted_by: null, deleted_reason: null,
  };
});

describe("GREEN — DELETE /clinical-notes/[id] soft-deletes and audits", () => {
  it("issues a soft-delete UPDATE (deleted_at/by/reason), NOT a physical delete", async () => {
    const { DELETE } = await import("../app/api/clinical-notes/[id]/route");
    const [req, ctx] = delReq(REC, "entered in error");
    const res = await DELETE(req, ctx);

    expect(res.status).toBe(200);
    expect(captured.delete).toBe(false);                       // row is RETAINED, not destroyed
    expect(captured.update).toBeDefined();
    expect(captured.update.deleted_at).toEqual(expect.any(String)); // marked deleted
    expect(captured.update.deleted_by).toBe(ADMIN);
    expect(captured.update.deleted_reason).toBe("entered in error"); // sanitize()'d reason persisted
  });

  it("writes an audit event with soft_delete:true (old + new)", async () => {
    const { DELETE } = await import("../app/api/clinical-notes/[id]/route");
    const [req, ctx] = delReq(REC, "duplicate");
    await DELETE(req, ctx);

    expect(mockAudit).toHaveBeenCalledTimes(1);
    const ev = mockAudit.mock.calls[0][0];
    expect(ev.action).toBe("delete_clinical_note");
    expect(ev.resourceType).toBe("clinical_note");
    expect(ev.resourceId).toBe(REC);
    expect(ev.metadata.soft_delete).toBe(true);
    expect(ev.oldData.id).toBe(REC);
    expect(ev.newData.deleted_at).toEqual(expect.any(String));
  });

  it("already-deleted note → 409 (no second write, no audit)", async () => {
    existingRow = { ...existingRow, deleted_at: "2026-01-01T00:00:00Z" };
    const { DELETE } = await import("../app/api/clinical-notes/[id]/route");
    const [req, ctx] = delReq(REC);
    const res = await DELETE(req, ctx);

    expect(res.status).toBe(409);
    expect(captured.update).toBeUndefined();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("missing note → 404", async () => {
    existingRow = null;
    const { DELETE } = await import("../app/api/clinical-notes/[id]/route");
    const [req, ctx] = delReq(REC);
    const res = await DELETE(req, ctx);

    expect(res.status).toBe(404);
    expect(captured.update).toBeUndefined();
    expect(mockAudit).not.toHaveBeenCalled();
  });
});

describe("GREEN — the dead collection DELETE is removed", () => {
  it("clinical-notes/route.ts no longer exports DELETE (single soft-delete path is /[id])", async () => {
    const collection = await import("../app/api/clinical-notes/route");
    expect((collection as any).DELETE).toBeUndefined();
    // The per-note route still owns delete.
    const idRoute = await import("../app/api/clinical-notes/[id]/route");
    expect(typeof (idRoute as any).DELETE).toBe("function");
  });
});
