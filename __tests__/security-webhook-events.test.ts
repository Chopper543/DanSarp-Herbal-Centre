/**
 * @jest-environment node
 *
 * Unit tests for the webhook-event lifecycle wrappers (fast, mock-based). The
 * REAL Postgres acquire/reclaim/lease/poison state machine is exercised against
 * pglite in __tests__/security-webhook-idempotency.dbtest.ts; this file just
 * pins the thin TS mapping (RPC result shape, the status-guarded UPDATEs).
 */
import {
  acquireWebhookEvent,
  markWebhookProcessed,
  markWebhookFailed,
} from "../lib/payments/webhook-events";

function rpcSupabase(rpcResult: { data: any; error: any }) {
  return { rpc: jest.fn().mockResolvedValue(rpcResult) };
}

/** Chainable, thenable stub for `.from().update().eq().eq().eq()`. */
function updateSupabase(result: { error: any } = { error: null }) {
  const chain: any = {};
  chain.update = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.then = (resolve: any) => resolve(result);
  return { supabase: { from: jest.fn(() => chain) }, chain };
}

describe("acquireWebhookEvent", () => {
  it("maps the RPC's single-row set to { result, attempts }", async () => {
    const sb = rpcSupabase({ data: [{ result: "acquired", attempts: 1 }], error: null });
    const out = await acquireWebhookEvent(sb as any, { provider: "paystack", eventId: "evt_1" });
    expect(out).toEqual({ result: "acquired", attempts: 1 });
    expect(sb.rpc).toHaveBeenCalledWith("acquire_webhook_event", expect.objectContaining({
      p_provider: "paystack",
      p_event_id: "evt_1",
    }));
  });

  it("passes through a duplicate_processed outcome", async () => {
    const sb = rpcSupabase({ data: [{ result: "duplicate_processed", attempts: 3 }], error: null });
    const out = await acquireWebhookEvent(sb as any, { provider: "flutterwave", eventId: "evt_2" });
    expect(out.result).toBe("duplicate_processed");
  });

  it("throws when the RPC errors (so the caller returns 5xx and the provider retries)", async () => {
    const sb = rpcSupabase({ data: null, error: { code: "42883", message: "no function" } });
    await expect(
      acquireWebhookEvent(sb as any, { provider: "ghana_rails", eventId: "evt_3" })
    ).rejects.toThrow(/acquire webhook event/i);
  });
});

describe("markWebhookProcessed / markWebhookFailed", () => {
  it("marks processed with a status='processing' guard", async () => {
    const { supabase, chain } = updateSupabase();
    await markWebhookProcessed(supabase as any, "paystack", "evt_1");
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "processed", processed_at: expect.any(String) })
    );
    expect(chain.eq).toHaveBeenCalledWith("status", "processing");
    expect(chain.eq).toHaveBeenCalledWith("provider", "paystack");
    expect(chain.eq).toHaveBeenCalledWith("event_id", "evt_1");
  });

  it("marks failed with the reason (truncated) and a status='processing' guard", async () => {
    const { supabase, chain } = updateSupabase();
    await markWebhookFailed(supabase as any, "ghana_rails", "evt_9", "boom");
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", last_error: "boom" })
    );
    expect(chain.eq).toHaveBeenCalledWith("status", "processing");
  });

  it("is best-effort: a DB error while marking does NOT throw", async () => {
    const { supabase } = updateSupabase({ error: { code: "XX000", message: "db down" } });
    await expect(markWebhookProcessed(supabase as any, "paystack", "evt_1")).resolves.toBeUndefined();
    await expect(markWebhookFailed(supabase as any, "paystack", "evt_1", "x")).resolves.toBeUndefined();
  });
});
