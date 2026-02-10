import {
  buildWebhookMetadata,
  getProcessedWebhookEventIds,
  resolveWebhookEventId,
  resolveWebhookEventType,
} from "@/lib/payments/webhook-idempotency";

describe("Webhook idempotency utilities", () => {
  it("extracts processed webhook IDs from metadata safely", () => {
    expect(getProcessedWebhookEventIds(null)).toEqual([]);
    expect(
      getProcessedWebhookEventIds({
        processed_webhook_event_ids: ["evt-1", 2, "evt-3"],
      })
    ).toEqual(["evt-1", "evt-3"]);
  });

  it("builds metadata with deduplicated event IDs", () => {
    const metadata: any = buildWebhookMetadata(
      { processed_webhook_event_ids: ["evt-1"], existing: true },
      "evt-2",
      "charge.completed",
      { provider_payload: { ok: true } }
    );

    expect(metadata.existing).toBe(true);
    expect(metadata.provider_payload).toEqual({ ok: true });
    expect(metadata.processed_webhook_event_ids).toEqual(["evt-1", "evt-2"]);
    expect(metadata.last_webhook_event_id).toBe("evt-2");
    expect(metadata.last_webhook_event_type).toBe("charge.completed");
  });

  it("resolves webhook event type from payload fields", () => {
    expect(resolveWebhookEventType({ type: "charge.completed" })).toBe("charge.completed");
    expect(resolveWebhookEventType({ event: "charge.success" })).toBe("charge.success");
    expect(resolveWebhookEventType({})).toBeNull();
  });

  it("resolves event id from explicit id and fallback signature", () => {
    const explicit = resolveWebhookEventId(
      "flutterwave",
      { id: "evt-123" },
      "charge.completed",
      "tx-ref-1"
    );
    expect(explicit).toBe("flutterwave:evt-123");

    const fallback = resolveWebhookEventId(
      "paystack",
      { data: { status: "success" } },
      "charge.success",
      "tx-ref-2"
    );
    expect(fallback).toBe("paystack:charge.success:tx-ref-2:success");
  });
});
