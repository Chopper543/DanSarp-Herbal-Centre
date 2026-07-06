import { logger } from "@/lib/monitoring/logger";

export type WebhookProvider = "paystack" | "flutterwave" | "ghana_rails";

export interface ClaimWebhookArgs {
  provider: WebhookProvider;
  eventId: string;
  eventType?: string | null;
  paymentId?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface ClaimWebhookResult {
  claimed: boolean;
  duplicate: boolean;
}

/**
 * Atomic webhook dedup. INSERT into webhook_events with the unique
 * (provider, event_id) constraint as the gatekeeper:
 *   - first arrival inserts → claimed=true
 *   - second arrival hits unique violation → duplicate=true, no work runs
 *
 * Postgres error code 23505 = unique_violation. PostgREST exposes it as
 * error.code "23505". Anything else is a real failure and must throw so
 * the webhook returns 5xx and the provider retries.
 */
export async function claimWebhookEvent(
  supabase: any,
  args: ClaimWebhookArgs
): Promise<ClaimWebhookResult> {
  const row = {
    provider: args.provider,
    event_id: args.eventId,
    event_type: args.eventType ?? null,
    payment_id: args.paymentId ?? null,
    payload: args.payload ?? null,
  };

  const { error } = await supabase.from("webhook_events").insert(row);
  if (!error) {
    return { claimed: true, duplicate: false };
  }

  if (error.code === "23505") {
    return { claimed: false, duplicate: true };
  }

  logger.error("Failed to claim webhook event", {
    provider: args.provider,
    event_id: args.eventId,
    error_code: error.code,
    error_message: error.message,
  });
  throw new Error("Failed to record webhook event");
}
