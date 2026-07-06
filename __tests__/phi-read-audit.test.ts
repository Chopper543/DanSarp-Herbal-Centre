/**
 * @jest-environment node
 *
 * Phase 6 — PHI read-audit coverage.
 *
 * Locks in the rule that cross-user reads of patient/profile/user data are
 * always recorded to audit_logs. Future refactors that drop the logAuditEvent
 * call will turn these tests red.
 */

const supabaseFromMock = jest.fn();
const getUserMock = jest.fn();
const getUserRoleMock = jest.fn();
const requireAuthMock = jest.fn();
const logAuditEventMock = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn().mockResolvedValue({
    from: (...args: any[]) => supabaseFromMock(...args),
    rpc: jest.fn(),
    auth: { getUser: (...args: any[]) => getUserMock(...args) },
  }),
}));
jest.mock("@/lib/auth/rbac", () => {
  const actual = jest.requireActual("@/lib/auth/rbac");
  return {
    ...actual,
    getUserRole: (...args: any[]) => getUserRoleMock(...args),
    requireAuth: (...args: any[]) => requireAuthMock(...args),
    isUserOnly: (role: string | null) => role === "user",
  };
});
jest.mock("@/lib/audit/log", () => ({
  logAuditEvent: (...args: any[]) => logAuditEventMock(...args),
}));
jest.mock("@/lib/monitoring/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
jest.mock("@/lib/utils/sanitize", () => ({
  sanitizeText: (s: string) => s,
  sanitizeHtml: (s: string) => s,
}));
jest.mock("@/lib/appointments/prerequisites", () => ({
  evaluateBookingPrerequisites: jest.fn().mockResolvedValue({ canProceed: true }),
}));
jest.mock("@/lib/email/resend", () => ({
  sendAppointmentConfirmation: jest.fn().mockResolvedValue(undefined),
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/whatsapp/twilio", () => ({
  sendAppointmentReminder: jest.fn().mockResolvedValue(undefined),
  sendWhatsAppMessage: jest.fn().mockResolvedValue(undefined),
}));

const ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PATIENT_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const APPT_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function makeGet(url: string) {
  const req = new Request(url) as any;
  req.nextUrl = new URL(url);
  return req;
}

beforeEach(() => {
  supabaseFromMock.mockReset();
  getUserMock.mockReset();
  getUserRoleMock.mockReset();
  requireAuthMock.mockReset();
  logAuditEventMock.mockReset().mockResolvedValue(undefined);
});

describe("GET /api/appointments — cross-user read audit", () => {
  it("admin reading a patient's appointment by id writes read_appointment", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: ADMIN_ID } } });
    getUserRoleMock.mockResolvedValue("admin");

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "appointments") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: APPT_ID, user_id: PATIENT_ID, status: "confirmed" },
                  error: null,
                }),
            }),
          }),
        };
      }
      return {};
    });

    const { GET } = await import("../app/api/appointments/route");
    const res = await GET(makeGet(`http://localhost/api/appointments?id=${APPT_ID}&admin=true`));
    expect(res.status).toBe(200);
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "read_appointment",
        resourceId: APPT_ID,
        metadata: expect.objectContaining({ patient_id: PATIENT_ID }),
      })
    );
  });

  it("self-read of own appointment does NOT log audit (avoid noise)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: PATIENT_ID } } });
    getUserRoleMock.mockResolvedValue("user");

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "appointments") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: APPT_ID, user_id: PATIENT_ID, status: "confirmed" },
                  error: null,
                }),
            }),
          }),
        };
      }
      return {};
    });

    const { GET } = await import("../app/api/appointments/route");
    const res = await GET(makeGet(`http://localhost/api/appointments?id=${APPT_ID}`));
    expect(res.status).toBe(200);
    expect(logAuditEventMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/profile — PHI guard + audit", () => {
  it("unauthenticated request returns 401 (no anon PII enumeration)", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { GET } = await import("../app/api/profile/route");
    const res = await GET(makeGet(`http://localhost/api/profile?user_id=${PATIENT_ID}`));
    expect(res.status).toBe(401);
  });

  it("non-admin requesting another user's profile gets 403 and writes profile_read_forbidden", async () => {
    const OTHER_USER = "dddddddd-dddd-dddd-dddd-dddddddddddd";
    getUserMock.mockResolvedValue({ data: { user: { id: PATIENT_ID } } });
    getUserRoleMock.mockResolvedValue("user");

    const { GET } = await import("../app/api/profile/route");
    const res = await GET(makeGet(`http://localhost/api/profile?user_id=${OTHER_USER}`));
    expect(res.status).toBe(403);
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "profile_read_forbidden",
        resourceId: OTHER_USER,
      })
    );
  });

  it("admin reading another user's profile writes admin_read_profile", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: ADMIN_ID } } });
    getUserRoleMock.mockResolvedValue("admin");

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: PATIENT_ID, email: "p@x", full_name: "P", role: "user" },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: { code: "PGRST116" } }),
            }),
          }),
        };
      }
      return {};
    });

    const { GET } = await import("../app/api/profile/route");
    const res = await GET(makeGet(`http://localhost/api/profile?user_id=${PATIENT_ID}`));
    expect(res.status).toBe(200);
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin_read_profile",
        resourceId: PATIENT_ID,
      })
    );
  });

  it("self-read does NOT log audit", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: PATIENT_ID } } });
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: PATIENT_ID, email: "p@x", full_name: "P", role: "user" },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: { code: "PGRST116" } }),
            }),
          }),
        };
      }
      return {};
    });

    const { GET } = await import("../app/api/profile/route");
    const res = await GET(makeGet(`http://localhost/api/profile`));
    expect(res.status).toBe(200);
    expect(logAuditEventMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/users — listing audit", () => {
  it("writes admin_list_users with page/limit/result_count", async () => {
    requireAuthMock.mockResolvedValue({ id: ADMIN_ID });
    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: () => ({
            order: () => ({
              range: () =>
                Promise.resolve({
                  data: [{ id: "u1" }, { id: "u2" }],
                  error: null,
                  count: 42,
                }),
            }),
          }),
        };
      }
      return {};
    });

    const { GET } = await import("../app/api/admin/users/route");
    const res = await GET(makeGet("http://localhost/api/admin/users?page=2&limit=10"));
    expect(res.status).toBe(200);
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin_list_users",
        metadata: expect.objectContaining({ page: 2, limit: 10, result_count: 2, total: 42 }),
      })
    );
  });
});
