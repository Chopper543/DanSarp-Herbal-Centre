export function getProcessedWebhookEventIds(
  metadata: Record<string, any> | null | undefined
): string[] {
  const ids = metadata?.processed_webhook_event_ids;
  if (!Array.isArray(ids)) return [];
  return ids.filter((value): value is string => typeof value === "string");
}

export function buildWebhookMetadata(
  metadata: Record<string, any> | null | undefined,
  eventId: string,
  eventType: string | null,
  providerPayload?: Record<string, any>
) {
  const existing = metadata || {};
  const processedIds = new Set(getProcessedWebhookEventIds(existing));
  processedIds.add(eventId);
  return {
    ...existing,
    ...(providerPayload || {}),
    processed_webhook_event_ids: Array.from(processedIds).slice(-200),
    last_webhook_event_id: eventId,
    last_webhook_event_type: eventType || null,
    last_webhook_received_at: new Date().toISOString(),
  };
}

export function resolveWebhookEventType(body: any): string | null {
  return body?.type || body?.event || null;
}

export function resolveWebhookEventId(
  provider: string,
  body: any,
  eventType: string | null,
  transactionRef: string
): string {
  const explicit =
    body?.id?.toString() ||
    body?.event_id?.toString() ||
    body?.data?.event_id?.toString() ||
    null;
  if (explicit) {
    return `${provider}:${explicit}`;
  }
  const status = body?.data?.status?.toString() || "unknown";
  return `${provider}:${eventType || "unknown"}:${transactionRef}:${status}`;
}
