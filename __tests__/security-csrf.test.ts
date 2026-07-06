/**
 * @jest-environment node
 */
import {
  CSRF_COOKIE_NAME,
  generateCsrfToken,
  isCsrfExemptPath,
  requireCsrfToken,
  setCsrfTokenCookie,
} from "../lib/security/csrf";

const SITE = "https://test.example.com";

function makeRequest(opts: {
  method?: string;
  path?: string;
  origin?: string | null;
  referer?: string | null;
  csrfHeader?: string | null;
  cookieToken?: string | null;
}) {
  const url = `${SITE}${opts.path ?? "/api/patients"}`;
  const headers: Record<string, string> = {};
  if (opts.origin !== null && opts.origin !== undefined) headers["origin"] = opts.origin;
  if (opts.referer !== null && opts.referer !== undefined) headers["referer"] = opts.referer;
  if (opts.csrfHeader) headers["x-csrf-token"] = opts.csrfHeader;
  if (opts.cookieToken) headers["cookie"] = `${CSRF_COOKIE_NAME}=${opts.cookieToken}`;
  return new Request(url, { method: opts.method ?? "POST", headers });
}

describe("setCsrfTokenCookie", () => {
  it("marks the cookie httpOnly + strict + path /", () => {
    const cookie = setCsrfTokenCookie("token-value");
    expect(cookie.name).toBe(CSRF_COOKIE_NAME);
    expect(cookie.value).toBe("token-value");
    expect(cookie.options.httpOnly).toBe(true);
    expect(cookie.options.sameSite).toBe("strict");
    expect(cookie.options.path).toBe("/");
    expect(cookie.options.maxAge).toBeGreaterThan(0);
  });
});

describe("isCsrfExemptPath", () => {
  it("exempts webhook paths", () => {
    expect(isCsrfExemptPath("/api/webhooks/paystack")).toBe(true);
    expect(isCsrfExemptPath("/api/payments/ghana-rails/webhook")).toBe(true);
  });
  it("does not exempt regular API paths", () => {
    expect(isCsrfExemptPath("/api/patients")).toBe(false);
    expect(isCsrfExemptPath("/api/auth/login")).toBe(false);
  });
});

describe("requireCsrfToken", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  beforeAll(() => {
    process.env.NEXT_PUBLIC_SITE_URL = SITE;
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  });

  it("skips validation for safe methods (GET)", async () => {
    const result = await requireCsrfToken(makeRequest({ method: "GET", origin: SITE }));
    expect(result.valid).toBe(true);
  });

  it("skips validation for exempt webhook paths", async () => {
    const result = await requireCsrfToken(
      makeRequest({ path: "/api/webhooks/paystack", origin: null, referer: null })
    );
    expect(result.valid).toBe(true);
  });

  it("rejects when Origin does not match the allowed site", async () => {
    const token = generateCsrfToken();
    const result = await requireCsrfToken(
      makeRequest({
        origin: "https://evil.example.com",
        csrfHeader: token,
        cookieToken: token,
      })
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/origin/i);
  });

  it("rejects when no Origin or Referer is present (state-changing request)", async () => {
    const token = generateCsrfToken();
    const result = await requireCsrfToken(
      makeRequest({
        origin: null,
        referer: null,
        csrfHeader: token,
        cookieToken: token,
      })
    );
    expect(result.valid).toBe(false);
  });

  it("rejects when CSRF header token is missing", async () => {
    const token = generateCsrfToken();
    const result = await requireCsrfToken(
      makeRequest({ origin: SITE, csrfHeader: null, cookieToken: token })
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/required/i);
  });

  it("rejects when header token does not match cookie token", async () => {
    const result = await requireCsrfToken(
      makeRequest({
        origin: SITE,
        csrfHeader: generateCsrfToken(),
        cookieToken: generateCsrfToken(),
      })
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/invalid/i);
  });

  it("accepts when Origin, header, and cookie all align", async () => {
    const token = generateCsrfToken();
    const result = await requireCsrfToken(
      makeRequest({ origin: SITE, csrfHeader: token, cookieToken: token })
    );
    expect(result.valid).toBe(true);
  });

  it("falls back to Referer when Origin is absent", async () => {
    const token = generateCsrfToken();
    const result = await requireCsrfToken(
      makeRequest({
        origin: null,
        referer: `${SITE}/admin/patients`,
        csrfHeader: token,
        cookieToken: token,
      })
    );
    expect(result.valid).toBe(true);
  });
});
