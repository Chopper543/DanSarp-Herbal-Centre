/**
 * @jest-environment node
 *
 * B1 — 2FA bypass proof.
 *
 * The middleware gate (lib/proxy.ts) decides "this session has cleared 2FA"
 * from the raw cookies `twofa_verified` / `twofa_required`. Those values are
 * client-forgeable (login/page.tsx writes them via document.cookie, and any
 * client can send `Cookie: twofa_verified=true` on a crafted request — httpOnly
 * does not stop an attacker SENDING a cookie).
 *
 * These tests model an enrolled staff user whose session has NOT completed the
 * OTP challenge, carrying forged cookies. The gate MUST reject them:
 *   - a gated page route  -> redirect to /login?twofa=1
 *   - a gated API route   -> 401
 * and no combination of client-set cookie values may grant access.
 *
 * They FAIL against the current code (the forged `twofa_verified=true` slips
 * through) and are the red proof of the bypass. Option B (a server-signed,
 * session-bound HMAC cookie + removing all client writes) turns them green.
 */
import { NextRequest } from "next/server";

// ---- Mocked session state (enrolled staff, OTP NOT completed) -------------
const sessionState = {
  user: { id: "user-1" } as { id: string } | null,
  userRow: { two_factor_enabled: true, role: "admin" } as
    | { two_factor_enabled: boolean; role: string }
    | null,
  sessionId: "sess-1",
};

// Minimal unsigned JWT carrying a `session_id` claim, matching what
// getSessionId() decodes from the Supabase access token.
function fakeAccessToken(sessionId: string): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    sub: "user-1",
    session_id: sessionId,
  })}.sig`;
}

function mockSupabase() {
  return {
    auth: {
      getUser: async () => ({ data: { user: sessionState.user } }),
      getSession: async () => ({
        data: {
          session: sessionState.user
            ? { access_token: fakeAccessToken(sessionState.sessionId) }
            : null,
        },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: sessionState.userRow }),
        }),
      }),
    }),
  };
}

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(async () => mockSupabase()),
}));

// updateSession is the "request allowed to proceed" path. If the gate lets a
// forged cookie through, proxy() returns this untouched (status 200, no
// Location) — which is exactly the bypass we assert against.
jest.mock("@/lib/supabase/middleware", () => {
  const { NextResponse } = require("next/server");
  return { updateSession: jest.fn(async () => NextResponse.next()) };
});

// Keep rate limiting inert so requests reach the 2FA gate deterministically.
jest.mock("@/lib/rate-limit", () => ({
  assertRateLimitConfigured: jest.fn(),
  checkRateLimit: jest.fn(async () => ({
    success: true,
    limit: 100,
    remaining: 99,
    reset: Math.floor(Date.now() / 1000) + 60,
  })),
  getRateLimitIdentifier: jest.fn(() => "test-id"),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { proxy } = require("@/lib/proxy");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { issueTwoFactorCookie } = require("@/lib/security/two-factor-cookie");

function requestWithCookie(pathname: string, cookie: string): NextRequest {
  return new NextRequest(new URL(`http://localhost${pathname}`), {
    headers: { cookie },
  });
}

describe("B1: forged 2FA cookies must not satisfy the middleware gate", () => {
  beforeEach(() => {
    sessionState.user = { id: "user-1" };
    sessionState.userRow = { two_factor_enabled: true, role: "admin" };
    sessionState.sessionId = "sess-1";
  });

  it("rejects a forged twofa_verified=true on a gated PAGE route (redirect to /login)", async () => {
    const res = await proxy(requestWithCookie("/dashboard", "twofa_verified=true"));
    const location = res.headers.get("location") || "";
    expect(location).toContain("/login");
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
  });

  it("rejects a forged twofa_verified=true on a gated API route (401)", async () => {
    const res = await proxy(
      requestWithCookie("/api/clinical-notes", "twofa_verified=true")
    );
    expect(res.status).toBe(401);
  });

  it("rejects a fully client-forged pair (twofa_required + twofa_verified) — no client cookie combination grants access", async () => {
    const res = await proxy(
      requestWithCookie("/dashboard", "twofa_required=true; twofa_verified=true")
    );
    const location = res.headers.get("location") || "";
    expect(location).toContain("/login");
  });

  it("ACCEPTS a valid server-signed proof bound to the CURRENT session", async () => {
    const cookie = issueTwoFactorCookie("user-1", "sess-1"); // matches mocked session
    const res = await proxy(
      requestWithCookie("/dashboard", `${cookie.name}=${cookie.value}`)
    );
    // Allowed: proxy falls through to updateSession() (NextResponse.next()),
    // status 200 with no redirect to /login.
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });

  it("REJECTS a valid proof minted for a DIFFERENT session (proves session binding)", async () => {
    const cookie = issueTwoFactorCookie("user-1", "sess-OTHER"); // current session is sess-1
    const res = await proxy(
      requestWithCookie("/dashboard", `${cookie.name}=${cookie.value}`)
    );
    const location = res.headers.get("location") || "";
    expect(location).toContain("/login");
  });

  it("REJECTS a valid proof for a DIFFERENT user id (proves user binding)", async () => {
    const cookie = issueTwoFactorCookie("attacker", "sess-1"); // current user is user-1
    const res = await proxy(
      requestWithCookie("/dashboard", `${cookie.name}=${cookie.value}`)
    );
    const location = res.headers.get("location") || "";
    expect(location).toContain("/login");
  });
});
