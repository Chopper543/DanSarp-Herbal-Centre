/**
 * @jest-environment node
 *
 * Verifies the hard rule: staff and admin accounts cannot self-disable 2FA.
 * The disable endpoint must return 403 BEFORE touching the user row in any
 * way that could lower their security posture.
 */

export {}; // mark as module so test-local const names don't collide with sibling tests

const supabaseFromMock = jest.fn();
const getUserMock = jest.fn();
const getUserRoleMock = jest.fn();
const checkRateLimitMock = jest.fn();
const logAuditEventMock = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn().mockResolvedValue({
    from: (...args: any[]) => supabaseFromMock(...args),
    auth: { getUser: (...args: any[]) => getUserMock(...args) },
  }),
}));
jest.mock("@/lib/auth/rbac", () => {
  const actual = jest.requireActual("@/lib/auth/rbac");
  return {
    ...actual,
    getUserRole: (...args: any[]) => getUserRoleMock(...args),
  };
});
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: any[]) => checkRateLimitMock(...args),
  getRateLimitIdentifier: () => "test-identity",
}));
jest.mock("@/lib/audit/log", () => ({
  logAuditEvent: (...args: any[]) => logAuditEventMock(...args),
}));
// otplib pulls in @scure/base (ESM) which Jest can't transform by default.
// The role-guard path never reaches TOTP verification, so a stub is enough.
jest.mock("otplib", () => ({ TOTP: class {} }));
jest.mock("base32.js", () => ({ decode: () => Buffer.from("") }), { virtual: true });
jest.mock("@/lib/security/crypto", () => ({
  decryptSecret: () => "stub-secret",
  hashBackupCode: (c: string) => `hashed:${c}`,
}));

process.env.TWO_FA_ENC_KEY = process.env.TWO_FA_ENC_KEY || "x".repeat(32);
process.env.PHI_FIELD_KEY = process.env.PHI_FIELD_KEY || "y".repeat(32);

function makeRequest() {
  return new Request("http://localhost/api/auth/2fa/disable", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  }) as any;
}

beforeEach(() => {
  supabaseFromMock.mockReset();
  getUserMock.mockReset();
  getUserRoleMock.mockReset();
  checkRateLimitMock.mockReset();
  logAuditEventMock.mockReset().mockResolvedValue(undefined);
  checkRateLimitMock.mockResolvedValue({ success: true, limit: 60, remaining: 59, reset: 0 });
  getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } } });
});

describe("POST /api/auth/2fa/disable — role guard", () => {
  it.each(["super_admin", "admin", "doctor", "nurse"])(
    "returns 403 (and never touches users table) for staff role: %s",
    async (role) => {
      getUserRoleMock.mockResolvedValue(role);
      const { POST } = await import("../app/api/auth/2fa/disable/route");
      const res = await POST(makeRequest());
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.code).toBe("TWOFA_DISABLE_FORBIDDEN_BY_ROLE");
      expect(supabaseFromMock).not.toHaveBeenCalled();
      expect(logAuditEventMock).toHaveBeenCalledWith(
        expect.objectContaining({ action: "2fa_disable_blocked" })
      );
    }
  );

  it("allows patient role 'user' to proceed past the role gate", async () => {
    getUserRoleMock.mockResolvedValue("user");
    // Stub the users-table update so the endpoint reaches its success path.
    supabaseFromMock.mockImplementation(() => ({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }));
    const { POST } = await import("../app/api/auth/2fa/disable/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
  });
});
