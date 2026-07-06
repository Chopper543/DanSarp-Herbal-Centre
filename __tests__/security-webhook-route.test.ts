/**
 * @jest-environment node
 *
 * Integration-style tests that exercise the webhook routes end-to-end while
 * mocking the Supabase client + the payment-service verifier. The point is
 * to lock the order-of-operations contract: the route must return 401 BEFORE
 * touching the database when a request has no valid signature.
 */

import crypto from "crypto";

const supabaseFromMock = jest.fn();
const verifyPaymentMock = jest.fn();
const sendEmailMock = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: supabaseFromMock }),
}));
jest.mock("@/lib/payments/payment-service", () => ({
  paymentService: { verifyPayment: (...args: any[]) => verifyPaymentMock(...args) },
}));
jest.mock("@/lib/email/resend", () => ({
  sendEmail: (...args: any[]) => sendEmailMock(...args),
}));

beforeEach(() => {
  supabaseFromMock.mockReset();
  verifyPaymentMock.mockReset();
});

const PAYSTACK_SECRET = "sk_test_paystack_secret_value_for_tests";
const FLUTTERWAVE_SECRET = "flw-test-secret-hash-value-for-tests";
process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET;
process.env.FLUTTERWAVE_SECRET_HASH = FLUTTERWAVE_SECRET;

function paystackBody() {
  return JSON.stringify({
    event: "charge.success",
    id: "evt_paystack_1",
    data: { reference: "txn_abc", status: "success" },
  });
}

function paystackSig(body: string) {
  return crypto.createHmac("sha512", PAYSTACK_SECRET).update(body).digest("hex");
}

function makeRequest(headers: Record<string, string>, body: string) {
  return new Request("http://localhost/api/webhooks/payments", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  }) as any;
}

describe("/api/webhooks/payments — order of operations", () => {
  it("returns 401 with zero DB calls when no provider signature header is present", async () => {
    const { POST } = await import("../app/api/webhooks/payments/route");
    const res = await POST(makeRequest({}, paystackBody()));
    expect(res.status).toBe(401);
    expect(supabaseFromMock).not.toHaveBeenCalled();
  });

  it("returns 401 with zero DB calls when Paystack signature is wrong", async () => {
    const { POST } = await import("../app/api/webhooks/payments/route");
    const body = paystackBody();
    const res = await POST(
      makeRequest({ "x-paystack-signature": "0".repeat(128) }, body)
    );
    expect(res.status).toBe(401);
    expect(supabaseFromMock).not.toHaveBeenCalled();
    expect(verifyPaymentMock).not.toHaveBeenCalled();
  });

  it("rejects a body delivered under the wrong provider header (Flutterwave header, Paystack payload)", async () => {
    const { POST } = await import("../app/api/webhooks/payments/route");
    const body = paystackBody();
    // Provide a Flutterwave-looking header so the router routes to Flutterwave
    // verification. Verification fails because the signature is bogus.
    const res = await POST(
      makeRequest({ "flutterwave-signature": "deadbeef" }, body)
    );
    expect(res.status).toBe(401);
    expect(supabaseFromMock).not.toHaveBeenCalled();
  });

  it("returns 200 dedup when webhook_events insert hits unique violation", async () => {
    const body = paystackBody();
    const sig = paystackSig(body);

    supabaseFromMock.mockImplementation((table: string) => {
      if (table === "webhook_events") {
        return {
          insert: jest.fn().mockResolvedValue({
            error: { code: "23505", message: "dup" },
          }),
        };
      }
      throw new Error(`unexpected table access: ${table}`);
    });

    const { POST } = await import("../app/api/webhooks/payments/route");
    const res = await POST(makeRequest({ "x-paystack-signature": sig }, body));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.duplicate).toBe(true);
    // Specifically: payments table was never queried because dedup short-circuited.
    expect(supabaseFromMock).toHaveBeenCalledWith("webhook_events");
    expect(supabaseFromMock).not.toHaveBeenCalledWith("payments");
  });
});

describe("/api/payments/ghana-rails/webhook — order of operations", () => {
  const GHANA_SECRET = "ghana-rails-shared-secret-for-tests-32ch";

  beforeAll(() => {
    process.env.GHANA_RAILS_WEBHOOK_SECRET = GHANA_SECRET;
    process.env.GHANA_RAILS_REQUIRE_SIGNATURE = "true";
  });

  function makeGhRequest(
    headers: Record<string, string>,
    body: string
  ) {
    return new Request("http://localhost/api/payments/ghana-rails/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body,
    }) as any;
  }

  it("rejects with 401 when bearer is missing — no DB access", async () => {
    const { POST } = await import("../app/api/payments/ghana-rails/webhook/route");
    const res = await POST(makeGhRequest({}, JSON.stringify({})));
    expect(res.status).toBe(401);
    expect(supabaseFromMock).not.toHaveBeenCalled();
  });

  it("rejects with 401 when bearer is right but signature is missing (strict mode)", async () => {
    const { POST } = await import("../app/api/payments/ghana-rails/webhook/route");
    const res = await POST(
      makeGhRequest(
        { authorization: `Bearer ${GHANA_SECRET}` },
        JSON.stringify({ provider_transaction_id: "tx", status: "completed" })
      )
    );
    expect(res.status).toBe(401);
    expect(supabaseFromMock).not.toHaveBeenCalled();
  });

  it("rejects with 401 when timestamp is outside the replay window", async () => {
    const body = JSON.stringify({ provider_transaction_id: "tx", status: "completed" });
    const staleTs = (Math.floor(Date.now() / 1000) - 60 * 60).toString();
    const sig = crypto
      .createHmac("sha256", GHANA_SECRET)
      .update(`${staleTs}.${body}`)
      .digest("hex");

    const { POST } = await import("../app/api/payments/ghana-rails/webhook/route");
    const res = await POST(
      makeGhRequest(
        {
          authorization: `Bearer ${GHANA_SECRET}`,
          "x-timestamp": staleTs,
          "x-signature": sig,
        },
        body
      )
    );
    expect(res.status).toBe(401);
    expect(supabaseFromMock).not.toHaveBeenCalled();
  });
});
