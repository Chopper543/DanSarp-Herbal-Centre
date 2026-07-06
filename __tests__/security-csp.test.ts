import { buildCsp, getStaticSecurityHeaders } from "../lib/security/csp";

describe("buildCsp", () => {
  const nonce = "abc123nonce==";

  it("embeds the per-request nonce in script-src", () => {
    const csp = buildCsp({ nonce, isDev: false });
    expect(csp).toContain(`'nonce-${nonce}'`);
  });

  it("uses strict-dynamic and never unsafe-inline/unsafe-eval in script-src in production", () => {
    const csp = buildCsp({ nonce, isDev: false });
    const scriptSrc = csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("script-src"));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("permits unsafe-eval only in dev mode (Next.js HMR)", () => {
    const csp = buildCsp({ nonce, isDev: true });
    const scriptSrc = csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("script-src"));
    expect(scriptSrc).toContain("'unsafe-eval'");
  });

  it("sets a hardened baseline (object-src none, frame-ancestors none)", () => {
    const csp = buildCsp({ nonce, isDev: false });
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
  });
});

describe("getStaticSecurityHeaders", () => {
  it("includes the expected hardening headers", () => {
    const headers = getStaticSecurityHeaders();
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
  });
});
