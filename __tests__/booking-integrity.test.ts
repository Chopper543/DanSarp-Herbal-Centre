/**
 * @jest-environment node
 *
 * Phase 5 — booking integrity.
 *
 * The POST handler now delegates the entire payment-check + slot-reserve
 * sequence to the book_appointment() Postgres function. These tests pin the
 * HTTP-status mapping for the RPC's error contract so that a future refactor
 * of the SQL function (or its SQLSTATE codes) cannot silently weaken the API.
 */

export {}; // mark as module so test-local const names don't collide with sibling tests

const supabaseRpcMock = jest.fn();
const supabaseFromMock = jest.fn();
const getUserMock = jest.fn();
const getUserRoleMock = jest.fn();
const evaluatePrereqMock = jest.fn();
const sendEmailMock = jest.fn().mockResolvedValue(undefined);
const sendAppointmentConfirmationMock = jest.fn().mockResolvedValue(undefined);
const sendAppointmentReminderMock = jest.fn().mockResolvedValue(undefined);
const logAuditEventMock = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn().mockResolvedValue({
    rpc: (...args: any[]) => supabaseRpcMock(...args),
    from: (...args: any[]) => supabaseFromMock(...args),
    auth: { getUser: (...args: any[]) => getUserMock(...args) },
  }),
}));
jest.mock("@/lib/auth/rbac", () => {
  const actual = jest.requireActual("@/lib/auth/rbac");
  return {
    ...actual,
    getUserRole: (...args: any[]) => getUserRoleMock(...args),
    isUserOnly: (role: string | null) => role === "user",
  };
});
jest.mock("@/lib/appointments/prerequisites", () => ({
  evaluateBookingPrerequisites: (...args: any[]) => evaluatePrereqMock(...args),
}));
jest.mock("@/lib/email/resend", () => ({
  sendAppointmentConfirmation: (...args: any[]) => sendAppointmentConfirmationMock(...args),
  sendEmail: (...args: any[]) => sendEmailMock(...args),
}));
jest.mock("@/lib/whatsapp/twilio", () => ({
  sendAppointmentReminder: (...args: any[]) => sendAppointmentReminderMock(...args),
  sendWhatsAppMessage: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/audit/log", () => ({
  logAuditEvent: (...args: any[]) => logAuditEventMock(...args),
}));
jest.mock("@/lib/monitoring/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
// isomorphic-dompurify (pulled in by lib/utils/sanitize) ships ESM that Jest
// can't transform; stub it since this test never sanitizes user content.
jest.mock("@/lib/utils/sanitize", () => ({
  sanitizeText: (s: string) => s,
  sanitizeHtml: (s: string) => s,
}));

const PATIENT_ID = "11111111-1111-1111-1111-111111111111";
const BRANCH_ID = "22222222-2222-2222-2222-222222222222";
const PAYMENT_ID = "33333333-3333-3333-3333-333333333333";
const APPOINTMENT_DATE = "2026-07-15T10:00:00.000Z";

function makePost(body: Record<string, unknown> = {}) {
  const req = new Request("http://localhost/api/appointments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      branch_id: BRANCH_ID,
      appointment_date: APPOINTMENT_DATE,
      treatment_type: "consultation",
      payment_id: PAYMENT_ID,
      ...body,
    }),
  }) as any;
  // Next's NextRequest exposes nextUrl; the handler uses it for audit info.
  req.nextUrl = new URL(req.url);
  return req;
}

beforeEach(() => {
  supabaseRpcMock.mockReset();
  supabaseFromMock.mockReset();
  getUserMock.mockReset();
  getUserRoleMock.mockReset();
  evaluatePrereqMock.mockReset();
  logAuditEventMock.mockReset().mockResolvedValue(undefined);

  getUserMock.mockResolvedValue({ data: { user: { id: PATIENT_ID } } });
  getUserRoleMock.mockResolvedValue("user");
  evaluatePrereqMock.mockResolvedValue({ canProceed: true });

  // Default: users/branches lookups for notifications return empty.
  supabaseFromMock.mockImplementation((table: string) => {
    if (table === "users" || table === "branches") {
      return {
        select: () => ({
          eq: () => ({ single: () => Promise.resolve({ data: null }) }),
        }),
      };
    }
    return {};
  });
});

describe("POST /api/appointments — RPC error mapping", () => {
  it("returns 409 SLOT_TAKEN when RPC raises P0001 (concurrent booking lost the race)", async () => {
    supabaseRpcMock.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "SLOT_TAKEN" },
    });

    const { POST } = await import("../app/api/appointments/route");
    const res = await POST(makePost());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe("SLOT_TAKEN");
    expect(supabaseRpcMock).toHaveBeenCalledWith(
      "book_appointment",
      expect.objectContaining({
        p_user_id: PATIENT_ID,
        p_branch_id: BRANCH_ID,
        p_appointment_date: APPOINTMENT_DATE,
        p_payment_id: PAYMENT_ID,
      })
    );
  });

  it("returns 422 PAYMENT_NOT_COMPLETED when RPC raises P0002", async () => {
    supabaseRpcMock.mockResolvedValue({
      data: null,
      error: { code: "P0002", message: "PAYMENT_NOT_COMPLETED" },
    });

    const { POST } = await import("../app/api/appointments/route");
    const res = await POST(makePost());
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.code).toBe("PAYMENT_NOT_COMPLETED");
  });

  it("returns 400 PAYMENT_NOT_FOUND when RPC raises P0003 (also covers payment-already-used)", async () => {
    supabaseRpcMock.mockResolvedValue({
      data: null,
      error: { code: "P0003", message: "PAYMENT_ALREADY_USED" },
    });

    const { POST } = await import("../app/api/appointments/route");
    const res = await POST(makePost());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("PAYMENT_NOT_FOUND");
  });

  it("returns 400 PAYMENT_AMOUNT_INVALID when RPC raises P0004", async () => {
    supabaseRpcMock.mockResolvedValue({
      data: null,
      error: { code: "P0004", message: "PAYMENT_AMOUNT_INVALID" },
    });

    const { POST } = await import("../app/api/appointments/route");
    const res = await POST(makePost());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("PAYMENT_AMOUNT_INVALID");
  });

  it("returns 201 with the appointment row on success", async () => {
    const created = {
      id: "44444444-4444-4444-4444-444444444444",
      user_id: PATIENT_ID,
      branch_id: BRANCH_ID,
      appointment_date: APPOINTMENT_DATE,
      treatment_type: "consultation",
      status: "pending",
    };
    supabaseRpcMock.mockResolvedValue({ data: created, error: null });

    const { POST } = await import("../app/api/appointments/route");
    const res = await POST(makePost());
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.appointment).toEqual(created);
  });
});

describe("POST /api/appointments — concurrent-booking race", () => {
  it("when two requests fire in parallel for the same slot, one gets 201 and one gets 409", async () => {
    // First caller wins the EXCLUDE constraint; second caller's RPC raises P0001.
    const winner = {
      id: "55555555-5555-5555-5555-555555555555",
      user_id: PATIENT_ID,
      branch_id: BRANCH_ID,
      appointment_date: APPOINTMENT_DATE,
      status: "pending",
    };
    supabaseRpcMock
      .mockResolvedValueOnce({ data: winner, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "P0001", message: "SLOT_TAKEN" },
      });

    const { POST } = await import("../app/api/appointments/route");
    const [resA, resB] = await Promise.all([POST(makePost()), POST(makePost())]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const loser = resA.status === 409 ? resA : resB;
    const loserBody = await loser.json();
    expect(loserBody.code).toBe("SLOT_TAKEN");
  });
});
