/**
 * @jest-environment node
 */
import { claimWebhookEvent } from "../lib/payments/webhook-events";

function makeSupabase(insertResult: { error: { code: string; message: string } | null }) {
  return {
    from(_table: string) {
      return {
        insert: jest.fn().mockResolvedValue(insertResult),
      };
    },
  };
}

describe("claimWebhookEvent", () => {
  it("returns claimed=true when insert succeeds", async () => {
    const sb = makeSupabase({ error: null });
    const result = await claimWebhookEvent(sb as any, {
      provider: "paystack",
      eventId: "evt_1",
    });
    expect(result.claimed).toBe(true);
    expect(result.duplicate).toBe(false);
  });

  it("returns duplicate=true when insert hits unique-violation (23505)", async () => {
    const sb = makeSupabase({ error: { code: "23505", message: "duplicate key" } });
    const result = await claimWebhookEvent(sb as any, {
      provider: "flutterwave",
      eventId: "evt_2",
    });
    expect(result.claimed).toBe(false);
    expect(result.duplicate).toBe(true);
  });

  it("throws on any non-unique-violation error", async () => {
    const sb = makeSupabase({ error: { code: "42P01", message: "no such table" } });
    await expect(
      claimWebhookEvent(sb as any, { provider: "ghana_rails", eventId: "evt_3" })
    ).rejects.toThrow(/record webhook event/i);
  });
});
