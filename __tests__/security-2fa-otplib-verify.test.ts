/**
 * @jest-environment node
 *
 * otplib v13 API mismatch — `new TOTP({ secret, createDigest, createRandomBytes })`
 * is the otplib-v12 plugin shape; otplib@13's TOTP class requires a real
 * `crypto`/`base32` plugin object and throws `CryptoPluginMissingError` the
 * moment `.verify()`/`.generate()` is called. Every real 2FA enrollment or
 * login attempt 500s today.
 *
 * These tests exercise the REAL otplib + @noble/hashes + @scure/base stack
 * (nothing about otplib/base32 is mocked) against the real route handlers,
 * submitting a genuine, currently-valid TOTP code -- exactly what a user's
 * authenticator app would produce. They fail (500) against the current
 * createDigest/createRandomBytes construction and must pass once the routes
 * use `crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin()`.
 */
import { TOTP, generateSecret, NobleCryptoPlugin, ScureBase32Plugin } from "otplib";
import { encryptSecret, hashBackupCode } from "@/lib/security/crypto";

// otplib's real crypto/base32 plugins (@noble/hashes, @scure/base) are slower
// to transform+load on a cold Jest run than the default 5s test timeout.
jest.setTimeout(20000);

async function currentCodeFor(secret: string): Promise<string> {
  const totp = new TOTP({
    secret,
    crypto: new NobleCryptoPlugin(),
    base32: new ScureBase32Plugin(),
  });
  return totp.generate();
}

const userRow: {
  two_factor_secret: string | null;
  two_factor_enabled: boolean;
  two_factor_backup_codes: string[] | null;
} = {
  two_factor_secret: null,
  two_factor_enabled: false,
  two_factor_backup_codes: null,
};

function fakeAccessToken(sessionId: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    sub: "user-1",
    session_id: sessionId,
  })}.sig`;
}

const updateMock = jest.fn(async (patch: Record<string, unknown>) => {
  Object.assign(userRow, patch);
  return { error: null };
});

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-1", email: "staff@example.com" } },
      }),
      getSession: async () => ({
        data: { session: { access_token: fakeAccessToken("sess-1") } },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { ...userRow } }),
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: () => updateMock(patch),
      }),
    }),
  })),
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(async () => ({
    success: true,
    limit: 60,
    remaining: 59,
    reset: Math.floor(Date.now() / 1000) + 60,
  })),
  getRateLimitIdentifier: jest.fn(() => "test-id"),
}));

jest.mock("@/lib/audit/log", () => ({
  logAuditEvent: jest.fn(async () => undefined),
}));

function postRequest(url: string, body: unknown) {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("otplib v13 fix: a real, currently-valid TOTP code is accepted (not a 500)", () => {
  // TOTP codes are only valid for a 30s window. Generating a code and then
  // POSTing it to the route are two separate real-clock moments; under a
  // loaded test run (many files, cold ESM transforms) that gap can
  // occasionally straddle a window boundary and flake. Freeze Date.now() to
  // the dead center of a window for the whole test so the code this test
  // generates and the code the route verifies are always evaluated against
  // the identical, deterministic "now".
  let dateNowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    jest.resetModules();
    updateMock.mockClear();
    userRow.two_factor_secret = null;
    userRow.two_factor_enabled = false;
    userRow.two_factor_backup_codes = null;

    const nowSec = Math.floor(Date.now() / 1000);
    const periodStart = nowSec - (nowSec % 30);
    const fixedNowMs = (periodStart + 15) * 1000; // dead center of the 30s window
    dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(fixedNowMs);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  it("enrollment verify (/api/auth/2fa/verify) accepts a real current code and enables 2FA", async () => {
    const secret = generateSecret();
    userRow.two_factor_secret = encryptSecret(secret);
    const code = await currentCodeFor(secret);

    const { POST } = await import("../app/api/auth/2fa/verify/route");
    const res = await POST(postRequest("/api/auth/2fa/verify", { code }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.backupCodes)).toBe(true);
    expect(userRow.two_factor_enabled).toBe(true);
  });

  it("enrollment verify (/api/auth/2fa/verify) still rejects a wrong code with 400 (not 500)", async () => {
    const secret = generateSecret();
    userRow.two_factor_secret = encryptSecret(secret);

    const { POST } = await import("../app/api/auth/2fa/verify/route");
    const res = await POST(postRequest("/api/auth/2fa/verify", { code: "000000" }));

    expect(res.status).toBe(400);
    expect(userRow.two_factor_enabled).toBe(false);
  });

  // otplib's TOTP.verify() throws (TokenFormatError) for anything that isn't
  // 6 numeric digits, rather than resolving invalid. Malformed input must
  // still land on the normal 400, not a generic 500.
  it("enrollment verify (/api/auth/2fa/verify) rejects a malformed (non-numeric) code with 400, not 500", async () => {
    const secret = generateSecret();
    userRow.two_factor_secret = encryptSecret(secret);

    const { POST } = await import("../app/api/auth/2fa/verify/route");
    const res = await POST(postRequest("/api/auth/2fa/verify", { code: "not-a-code" }));

    expect(res.status).toBe(400);
    expect(userRow.two_factor_enabled).toBe(false);
  });

  it("login verify (/api/auth/2fa/verify-login) accepts a real current code and issues the 2FA cookie", async () => {
    const secret = generateSecret();
    userRow.two_factor_secret = encryptSecret(secret);
    userRow.two_factor_enabled = true;
    const code = await currentCodeFor(secret);

    const { POST } = await import("../app/api/auth/2fa/verify-login/route");
    const res = await POST(postRequest("/api/auth/2fa/verify-login", { code }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toContain("twofa_verified=");
  });

  it("login verify (/api/auth/2fa/verify-login) still rejects a wrong code with 400 (not 500, not silently accepted)", async () => {
    const secret = generateSecret();
    userRow.two_factor_secret = encryptSecret(secret);
    userRow.two_factor_enabled = true;
    userRow.two_factor_backup_codes = [];

    const { POST } = await import("../app/api/auth/2fa/verify-login/route");
    const res = await POST(postRequest("/api/auth/2fa/verify-login", { code: "000000" }));

    expect(res.status).toBe(400);
  });

  // Regression coverage for the .valid destructure: verify-login ORs the TOTP
  // result with the backup-code check (`if (!isValidTotp && !isBackupCode)`).
  // A wrong-shaped isValidTotp (e.g. still the raw truthy object) would mask
  // whether the backup-code branch is doing its own job correctly.
  it("login verify (/api/auth/2fa/verify-login) accepts a valid backup code and consumes it", async () => {
    const secret = generateSecret();
    userRow.two_factor_secret = encryptSecret(secret);
    userRow.two_factor_enabled = true;
    const backupCode = "AB12CD34";
    userRow.two_factor_backup_codes = [hashBackupCode(backupCode), hashBackupCode("UNUSED01")];

    const { POST } = await import("../app/api/auth/2fa/verify-login/route");
    const res = await POST(postRequest("/api/auth/2fa/verify-login", { code: backupCode }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toContain("twofa_verified=");
    // The used backup code is removed; the untouched one survives.
    expect(userRow.two_factor_backup_codes).toEqual([hashBackupCode("UNUSED01")]);
  });

  it("login verify (/api/auth/2fa/verify-login) rejects a code that is neither a valid TOTP nor a known backup code", async () => {
    const secret = generateSecret();
    userRow.two_factor_secret = encryptSecret(secret);
    userRow.two_factor_enabled = true;
    userRow.two_factor_backup_codes = [hashBackupCode("REAL0001")];

    const { POST } = await import("../app/api/auth/2fa/verify-login/route");
    const res = await POST(postRequest("/api/auth/2fa/verify-login", { code: "FAKE0002" }));

    expect(res.status).toBe(400);
    // Unrelated backup code must be untouched.
    expect(userRow.two_factor_backup_codes).toEqual([hashBackupCode("REAL0001")]);
  });

  it("disable-with-code (/api/auth/2fa/disable) accepts a real current code for a non-staff user", async () => {
    const secret = generateSecret();
    userRow.two_factor_secret = encryptSecret(secret);
    userRow.two_factor_enabled = true;
    userRow.two_factor_backup_codes = [];
    const code = await currentCodeFor(secret);

    jest.doMock("@/lib/auth/rbac", () => ({
      getUserRole: jest.fn(async () => "user"),
      requires2FA: jest.fn(() => false),
    }));

    const { POST } = await import("../app/api/auth/2fa/disable/route");
    const res = await POST(postRequest("/api/auth/2fa/disable", { code }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
