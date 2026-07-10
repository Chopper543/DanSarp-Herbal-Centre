/**
 * @jest-environment node
 *
 * GREEN — read-path completeness. A soft-deleted clinical note is now HIDDEN by
 * default from BOTH GET /api/clinical-notes/[id] and GET /api/clinical-notes/
 * search (each applies `.is("deleted_at", null)`), yet stays RETRIEVABLE with
 * `include_history=true` — the retention requirement made real: deleted-from-view
 * but NOT gone, so audit/legal review can still reach it. Matches the list route
 * convention (clinical-notes/route.ts:159-161).
 *
 * The Supabase mock simulates the filter: when `.is("deleted_at", null)` was
 * applied it drops soft-deleted rows (empty result); otherwise it returns them.
 * (Was RED: proved both read paths served/listed a soft-deleted note with no
 * deleted_at guard — the half-deleted asymmetry.)
 */
export {}; // module scope

const ADMIN = "11111111-1111-1111-1111-111111111111";
const PATIENT = "22222222-2222-2222-2222-222222222222";
const DOCTOR = "99999999-9999-9999-9999-999999999999";
const REC = "44444444-4444-4444-4444-444444444444";

const isCalls: Array<[string, any]> = [];
const deletedRow = {
  id: REC, patient_id: PATIENT, doctor_id: DOCTOR,
  is_template: false, superseded_by_id: null,
  subjective: "retained content", objective: "o", assessment: "a", plan: "p",
  deleted_at: "2026-01-01T00:00:00Z", deleted_by: ADMIN, deleted_reason: "entered in error",
};

jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: ADMIN } } }) },
    from() {
      const b: any = { _single: false, _deletedAtNull: false };
      b.select = () => b;
      b.eq = () => b;
      b.or = () => b;
      b.ilike = () => b;
      b.limit = () => b;
      b.order = () => b;
      b.range = () => b;
      b.is = (col: string, val: any) => {
        isCalls.push([col, val]);
        if (col === "deleted_at" && val === null) b._deletedAtNull = true;
        return b;
      };
      b.single = () => { b._single = true; return b; };
      b.then = (resolve: any) => {
        // Simulate the DB filter: if deleted_at IS NULL was applied, a
        // soft-deleted row is excluded.
        const rows = b._deletedAtNull ? [deletedRow].filter((r) => r.deleted_at == null) : [deletedRow];
        if (b._single) {
          const row = rows[0] || null;
          return resolve({ data: row, error: row ? null : { code: "PGRST116", message: "no rows" } });
        }
        return resolve({ data: rows, error: null, count: rows.length });
      };
      return b;
    },
  }),
}));
jest.mock("@/lib/auth/rbac", () => ({ getUserRole: async () => "admin", isDoctor: (r: string) => r === "doctor" }));
jest.mock("@/lib/auth/role-capabilities", () => ({ canAccessSection: () => true }));
jest.mock("@/lib/utils/sanitize", () => ({ sanitizeText: (s: string) => s }));
jest.mock("@/lib/audit/phi-read", () => ({ logPhiRead: async () => undefined }));
jest.mock("@/lib/audit/log", () => ({ logAuditEvent: async () => undefined }));

const hasDeletedAtFilter = () => isCalls.some(([c, v]) => c === "deleted_at" && v === null);

beforeEach(() => { isCalls.length = 0; });

describe("GREEN — GET /clinical-notes/[id] hides soft-deleted by default, returns with include_history", () => {
  it("default request → 404 (hidden) and applies the deleted_at filter", async () => {
    const { GET } = await import("../app/api/clinical-notes/[id]/route");
    const req = { headers: new Headers(), nextUrl: { pathname: `/api/clinical-notes/${REC}` }, url: `http://x/api/clinical-notes/${REC}` } as any;
    const res = await GET(req, { params: Promise.resolve({ id: REC }) });

    expect(res.status).toBe(404);            // soft-deleted note is hidden from the direct link
    expect(hasDeletedAtFilter()).toBe(true); // `.is("deleted_at", null)` guard now present
  });

  it("include_history=true → RETURNS the soft-deleted note, no filter (audit/legal escape hatch)", async () => {
    const { GET } = await import("../app/api/clinical-notes/[id]/route");
    const req = { headers: new Headers(), nextUrl: { pathname: `/api/clinical-notes/${REC}` }, url: `http://x/api/clinical-notes/${REC}?include_history=true` } as any;
    const res = await GET(req, { params: Promise.resolve({ id: REC }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.note.id).toBe(REC);           // retained note is still reachable for review
    expect(body.note.deleted_at).not.toBeNull();
    expect(hasDeletedAtFilter()).toBe(false); // escape hatch: filter NOT applied
  });
});

describe("GREEN — GET /clinical-notes/search excludes soft-deleted by default, includes with include_history", () => {
  it("default request → note excluded and applies the deleted_at filter", async () => {
    const { GET } = await import("../app/api/clinical-notes/search/route");
    const req = { headers: new Headers(), nextUrl: { pathname: "/api/clinical-notes/search" }, url: "http://x/api/clinical-notes/search?q=retained" } as any;
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.notes.map((n: any) => n.id)).not.toContain(REC); // soft-deleted note excluded from search
    expect(hasDeletedAtFilter()).toBe(true);
  });

  it("include_history=true → INCLUDES the soft-deleted note, no filter", async () => {
    const { GET } = await import("../app/api/clinical-notes/search/route");
    const req = { headers: new Headers(), nextUrl: { pathname: "/api/clinical-notes/search" }, url: "http://x/api/clinical-notes/search?q=retained&include_history=true" } as any;
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.notes.map((n: any) => n.id)).toContain(REC); // retrievable for audit/legal review
    expect(hasDeletedAtFilter()).toBe(false);
  });
});
