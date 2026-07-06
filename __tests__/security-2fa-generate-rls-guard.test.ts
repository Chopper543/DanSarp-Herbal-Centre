/**
 * @jest-environment node
 *
 * /api/auth/2fa/generate must not return 200 with a QR code for a secret
 * that was never actually persisted. Today it does: the route's
 * `.update({ two_factor_secret }).eq("id", user.id)` call doesn't check
 * affected row count, so an RLS policy silently dropping the write (as
 * happens today for every non-admin staff role -- see FIXES.md) looks
 * identical to success. The fix chains `.select()` and fails closed (500)
 * when zero rows come back.
 */
// otplib's real crypto/base32 plugins (@noble/hashes, @scure/base) are slower
// to transform+load on a cold Jest run than the default 5s test timeout.
jest.setTimeout(20000);

jest.mock("otplib", () => {
  const actual = jest.requireActual("otplib");
  return { ...actual, generateSecret: () => "JBSWY3DPEHPK3PXP" };
});

const eqMock = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-1", email: "staff@example.com" } },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { two_factor_enabled: false, two_factor_secret: null },
          }),
        }),
      }),
      update: () => ({ eq: eqMock }),
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

function postRequest() {
  return new Request("http://localhost/api/auth/2fa/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
  }) as any;
}

describe("generate route fails closed when the DB write is silently dropped", () => {
  beforeEach(() => {
    jest.resetModules();
    eqMock.mockReset();
  });

  it("returns 500 (not 200) when the update affects 0 rows (e.g. blocked by RLS)", async () => {
    // Simulates the current RLS gap: no error, but no rows either.
    eqMock.mockReturnValue({
      select: () => Promise.resolve({ data: [], error: null }),
    });

    const { POST } = await import("../app/api/auth/2fa/generate/route");
    const res = await POST(postRequest());

    expect(res.status).toBe(500);
  });

  it("returns 200 when the update genuinely affects a row", async () => {
    eqMock.mockReturnValue({
      select: () => Promise.resolve({ data: [{ id: "user-1" }], error: null }),
    });

    const { POST } = await import("../app/api/auth/2fa/generate/route");
    const res = await POST(postRequest());

    expect(res.status).toBe(200);
  });
});
