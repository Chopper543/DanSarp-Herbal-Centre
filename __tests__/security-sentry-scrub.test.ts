import { scrubBreadcrumb, scrubSentryEvent } from "../lib/monitoring/sentry-scrub";

describe("scrubSentryEvent", () => {
  it("reduces user object to id only", () => {
    const event: any = {
      user: { id: "u1", email: "patient@example.com", username: "Jane Doe", ip_address: "1.2.3.4" },
    };
    const out: any = scrubSentryEvent(event);
    expect(out.user).toEqual({ id: "u1" });
  });

  it("strips cookies and sensitive headers from request", () => {
    const event: any = {
      request: {
        url: "https://app.example.com/api/patients?email=foo@bar.com",
        cookies: { session: "abc" },
        headers: {
          cookie: "csrf-token=secret",
          authorization: "Bearer token",
          "user-agent": "Mozilla",
        },
        data: { email: "foo@bar.com", note: "ok" },
      },
    };
    const out: any = scrubSentryEvent(event);
    expect(out.request.cookies).toBeUndefined();
    expect(out.request.headers.cookie).toBe("[REDACTED]");
    expect(out.request.headers.authorization).toBe("[REDACTED]");
    expect(out.request.headers["user-agent"]).toBe("Mozilla");
    expect(out.request.data.email).toBe("[REDACTED]");
    expect(out.request.data.note).toBe("ok");
    expect(out.request.url).not.toContain("foo@bar.com");
  });

  it("scrubs PHI fields from extra and exception messages", () => {
    const event: any = {
      extra: {
        patient_id: "pat_123",
        diagnosis: "Hypertension",
        appointment_id: "apt_42",
      },
      exception: {
        values: [{ value: "failed to send to patient@example.com from +233244123456" }],
      },
      message: "Sync error for patient@example.com",
    };
    const out: any = scrubSentryEvent(event);
    expect(out.extra.patient_id).toBe("[REDACTED]");
    expect(out.extra.diagnosis).toBe("[REDACTED]");
    expect(out.extra.appointment_id).toBe("apt_42");
    expect(out.exception.values[0].value).not.toContain("patient@example.com");
    expect(out.exception.values[0].value).not.toContain("+233244123456");
    expect(out.message).not.toContain("patient@example.com");
  });

  it("redacts long token-like strings inside scrubbed values", () => {
    const event: any = {
      message: "Bearer abcdefghijklmnopqrstuvwxyz0123456789ABCDEF was rejected",
    };
    const out: any = scrubSentryEvent(event);
    expect(out.message).toContain("[REDACTED]");
  });
});

describe("scrubBreadcrumb", () => {
  it("drops ui.click breadcrumbs (may carry patient-facing text)", () => {
    expect(scrubBreadcrumb({ category: "ui.click", message: "Clicked John Doe" })).toBeNull();
    expect(scrubBreadcrumb({ category: "ui.input", message: "Typed in field" })).toBeNull();
  });

  it("scrubs URL params and messages on navigation breadcrumbs", () => {
    const out = scrubBreadcrumb({
      category: "navigation",
      message: "navigated to /admin?email=foo@bar.com",
      data: { url: "/admin?email=foo@bar.com" },
    });
    expect(out).not.toBeNull();
    expect(out!.message).not.toContain("foo@bar.com");
    expect((out!.data as any).url).not.toContain("foo@bar.com");
  });
});
