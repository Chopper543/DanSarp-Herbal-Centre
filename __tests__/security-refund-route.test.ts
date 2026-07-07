/**
 * @jest-environment node
 *
 * Route-level proof of the LOCKED refund failure routing (mock provider + service
 * client). The DB-level atomicity / needs_reconciliation guard is in
 * __tests__/security-refund-atomicity.dbtest.ts; this pins the TS control flow:
 *   pre-provider failure (would-exceed, intent-write)  -> 'failed'
 *   provider-call failure / non-refunded / finalize     -> 'needs_reconciliation'
 */
export {}; // ensure module scope (isolates top-level test doubles from other suites)

const getUserRoleMock = jest.fn().mockResolvedValue("finance_manager");
const refundPaymentMock = jest.fn();
const logAuditMock = jest.fn().mockResolvedValue(undefined);

let service: any;
let terminalWrites: string[];
let rpcMock: jest.Mock;

jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "op-1" } } }) },
  }),
}));
jest.mock("@/lib/supabase/service", () => ({ createServiceClient: () => service }));
jest.mock("@/lib/auth/rbac", () => ({ getUserRole: (...a: any[]) => getUserRoleMock(...a) }));
jest.mock("@/lib/payments/payment-service", () => ({
  paymentService: {
    registerProvider: jest.fn(),
    refundPayment: (...a: any[]) => refundPaymentMock(...a),
  },
}));
jest.mock("@/lib/audit/log", () => ({ logAuditEvent: (...a: any[]) => logAuditMock(...a) }));

const REQ_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

/** Mock service client that records which terminal status the route writes. */
function makeService(opts: {
  refund: any;
  payment: any;
  intentError?: string;
  finalizeError?: string;
}) {
  terminalWrites = [];
  rpcMock = jest.fn(async () => {
    if (opts.finalizeError) return { data: null, error: { message: opts.finalizeError } };
    return { data: [{ ...opts.refund, status: "processed" }], error: null };
  });
  const from = (table: string) => {
    const b: any = { table, op: null, obj: null };
    b.select = () => b;
    b.update = (obj: any) => { b.op = "update"; b.obj = obj; return b; };
    b.eq = () => b;
    b.single = () => b;
    b.then = (resolve: any) => resolve(resolveB(b));
    return b;
  };
  function resolveB(b: any) {
    if (b.op === "update") {
      const s = b.obj.status;
      if (s === "processing") return { data: { ...opts.refund, status: "processing" }, error: null }; // claim
      if (b.obj.provider_call_attempted_at) {
        return { error: opts.intentError ? { message: opts.intentError } : null }; // intent
      }
      if (s === "failed" || s === "needs_reconciliation") { terminalWrites.push(s); return { error: null }; }
      return { error: null };
    }
    if (b.table === "payments") return { data: opts.payment, error: null };
    return { data: opts.refund, error: null }; // refund load
  }
  service = { from, rpc: rpcMock };
}

function patchReq(body: any) {
  return {
    json: async () => body,
    headers: new Headers({ "user-agent": "jest" }),
    nextUrl: { pathname: "/api/refunds" },
  } as any;
}

const baseRefund = { id: REQ_ID, payment_id: "pay-1", amount: 500, status: "approved" };
const okPayment = {
  id: "pay-1", provider: "paystack", provider_transaction_id: "txn-1",
  amount: 500, refunded_amount: 0, status: "completed",
};

beforeEach(() => {
  getUserRoleMock.mockClear();
  refundPaymentMock.mockReset();
  logAuditMock.mockClear();
});

describe("PATCH /api/refunds — failure routing", () => {
  it("would-exceed (pre-provider) -> 'failed', provider NEVER called", async () => {
    makeService({ refund: baseRefund, payment: { ...okPayment, refunded_amount: 200 } }); // 200+500 > 500
    const { PATCH } = await import("../app/api/refunds/route");
    const res = await PATCH(patchReq({ request_id: REQ_ID, action: "process" }));
    expect(res.status).toBe(422);
    expect(terminalWrites).toEqual(["failed"]);
    expect(refundPaymentMock).not.toHaveBeenCalled();
  });

  it("intent-write failure (pre-provider) -> 'failed', provider NEVER called", async () => {
    makeService({ refund: baseRefund, payment: okPayment, intentError: "db down" });
    const { PATCH } = await import("../app/api/refunds/route");
    const res = await PATCH(patchReq({ request_id: REQ_ID, action: "process" }));
    expect(res.status).toBe(502);
    expect(terminalWrites).toEqual(["failed"]);
    expect(refundPaymentMock).not.toHaveBeenCalled();
  });

  it("provider throw -> 'needs_reconciliation' (money may have moved)", async () => {
    makeService({ refund: baseRefund, payment: okPayment });
    refundPaymentMock.mockRejectedValue(new Error("network timeout"));
    const { PATCH } = await import("../app/api/refunds/route");
    const res = await PATCH(patchReq({ request_id: REQ_ID, action: "process" }));
    expect(res.status).toBe(502);
    expect(terminalWrites).toEqual(["needs_reconciliation"]);
  });

  it("provider returns non-refunded -> 'needs_reconciliation'", async () => {
    makeService({ refund: baseRefund, payment: okPayment });
    refundPaymentMock.mockResolvedValue({ status: "pending" });
    const { PATCH } = await import("../app/api/refunds/route");
    const res = await PATCH(patchReq({ request_id: REQ_ID, action: "process" }));
    expect(res.status).toBe(502);
    expect(terminalWrites).toEqual(["needs_reconciliation"]);
  });

  it("provider ok but finalize fails -> 'needs_reconciliation' (money moved, not recorded)", async () => {
    makeService({ refund: baseRefund, payment: okPayment, finalizeError: "rpc boom" });
    refundPaymentMock.mockResolvedValue({ status: "refunded", provider_transaction_id: "rf-1" });
    const { PATCH } = await import("../app/api/refunds/route");
    const res = await PATCH(patchReq({ request_id: REQ_ID, action: "process" }));
    expect(res.status).toBe(502);
    expect(terminalWrites).toEqual(["needs_reconciliation"]);
  });

  it("happy path -> 200 processed, no terminal write, finalize RPC called", async () => {
    makeService({ refund: baseRefund, payment: okPayment });
    refundPaymentMock.mockResolvedValue({ status: "refunded", provider_transaction_id: "rf-1" });
    const { PATCH } = await import("../app/api/refunds/route");
    const res = await PATCH(patchReq({ request_id: REQ_ID, action: "process" }));
    expect(res.status).toBe(200);
    expect(terminalWrites).toEqual([]);
    expect(rpcMock).toHaveBeenCalledWith("finalize_refund", expect.objectContaining({ p_request_id: REQ_ID }));
  });
});
