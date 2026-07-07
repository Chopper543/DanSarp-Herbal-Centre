import { logger } from "@/lib/monitoring/logger";

export type WebhookProvider = "paystack" | "flutterwave" | "ghana_rails";

/**
 * Idempotency tuning — the ONE place these live.
 *   MAX_ATTEMPTS: after this many processing attempts a poison event is marked
 *                 'dead' (stop reprocessing, alert) instead of churning forever.
 *   LEASE:        a 'processing' row older than this is considered orphaned (its
 *                 worker crashed) and may be reclaimed by a retry. Postgres
 *                 interval literal.
 */
export const WEBHOOK_MAX_ATTEMPTS = 5;
export const WEBHOOK_LEASE = "5 minutes";

export interface AcquireWebhookArgs {
  provider: WebhookProvider;
  eventId: string;
  eventType?: string | null;
  payload?: Record<string, unknown> | null;
}

export type AcquireResult = "acquired" | "duplicate_processed" | "in_flight" | "dead";

export interface AcquireWebhookOutcome {
  result: AcquireResult;
  attempts: number;
}

/**
 * Atomically claim (or reclaim) a webhook event for processing via the
 * acquire_webhook_event RPC. The insert-or-reclaim decision happens in one
 * transaction inside Postgres, so concurrent duplicate deliveries can't both
 * acquire. Returns what the caller should do:
 *   - 'acquired'            → process it, then markWebhookProcessed on success
 *   - 'duplicate_processed' → already done, return 200 and skip
 *   - 'in_flight'           → another worker holds a fresh lease, return 503
 *   - 'dead'               → attempts exhausted, return 200, skip + already logged
 */
export async function acquireWebhookEvent(
  supabase: any,
  args: AcquireWebhookArgs
): Promise<AcquireWebhookOutcome> {
  const { data, error } = await supabase.rpc("acquire_webhook_event", {
    p_provider: args.provider,
    p_event_id: args.eventId,
    p_event_type: args.eventType ?? null,
    p_payload: args.payload ?? null,
    p_max_attempts: WEBHOOK_MAX_ATTEMPTS,
    p_lease: WEBHOOK_LEASE,
  });

  if (error) {
    logger.error("Failed to acquire webhook event", {
      provider: args.provider,
      event_id: args.eventId,
      error_code: error.code,
      error_message: error.message,
    });
    throw new Error("Failed to acquire webhook event");
  }

  // acquire_webhook_event RETURNS TABLE(...) → a single-row set.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.result !== "string") {
    throw new Error("acquire_webhook_event returned no row");
  }
  return { result: row.result as AcquireResult, attempts: Number(row.attempts) };
}

/**
 * Mark an acquired event 'processed' — call ONLY after the full processing path
 * (including appointment creation) has succeeded. Guarded on status='processing'
 * so a stale worker can't overwrite a newer state. Best-effort: a failure here
 * doesn't undo the completed work, so we log rather than throw.
 */
export async function markWebhookProcessed(
  supabase: any,
  provider: WebhookProvider,
  eventId: string
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("webhook_events")
    .update({ status: "processed", processed_at: now, updated_at: now })
    .eq("provider", provider)
    .eq("event_id", eventId)
    .eq("status", "processing");
  if (error) {
    logger.error("Failed to mark webhook processed (work already succeeded)", {
      provider,
      event_id: eventId,
      error_code: error.code,
      error_message: error.message,
    });
  }
}

/**
 * Mark an acquired event 'failed' so a retry can reclaim and reprocess it.
 * Guarded on status='processing'. Best-effort: we're already on a failure path,
 * so a failure to record the failure is logged, not thrown.
 */
export async function markWebhookFailed(
  supabase: any,
  provider: WebhookProvider,
  eventId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase
    .from("webhook_events")
    .update({
      status: "failed",
      last_error: (reason || "unknown").slice(0, 1000),
      updated_at: new Date().toISOString(),
    })
    .eq("provider", provider)
    .eq("event_id", eventId)
    .eq("status", "processing");
  if (error) {
    logger.error("Failed to mark webhook failed", {
      provider,
      event_id: eventId,
      error_code: error.code,
      error_message: error.message,
    });
  }
}
