import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/monitoring/logger";
import { buildWebhookMetadata } from "@/lib/payments/webhook-idempotency";
import {
  acquireWebhookEvent,
  markWebhookProcessed,
  markWebhookFailed,
} from "@/lib/payments/webhook-events";
import { ensureAppointmentForCompletedPayment } from "@/lib/payments/ensure-appointment";
import {
  safeBearerEqual,
  verifyGhanaRailsSignature,
} from "@/lib/payments/ghana-rails-signature";
import { validateRequestSize, getMaxSizeForContentType } from "@/lib/utils/validate-request-size";

const WEBHOOK_SECRET = process.env.GHANA_RAILS_WEBHOOK_SECRET;
// Strict mode requires both bearer AND HMAC signature; default to true in
// production. Set to "false" only during partner rollout if the sender
// hasn't deployed signature support yet.
const REQUIRE_SIGNATURE = process.env.GHANA_RAILS_REQUIRE_SIGNATURE !== "false";

type GhanaRailsWebhookPayload = {
  id?: string;
  event_id?: string;
  type?: string;
  provider_transaction_id: string;
  status: "pending" | "completed" | "failed" | "processing";
  metadata?: Record<string, any>;
};

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    logger.error("GHANA_RAILS_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // 1. Bearer check (timing-safe). Failures look identical to signature
  //    failures from the outside — generic 401.
  if (!safeBearerEqual(request.headers.get("authorization"), WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Size guard. Middleware skips this for webhook paths.
  const sizeCheck = await validateRequestSize(
    request,
    getMaxSizeForContentType(request.headers.get("content-type"))
  );
  if (sizeCheck) return sizeCheck;

  // 3. HMAC + replay-window check on the raw body.
  const rawBody = await request.text();
  const sigCheck = verifyGhanaRailsSignature({
    rawBody,
    timestamp: request.headers.get("x-timestamp"),
    signature: request.headers.get("x-signature"),
    secret: WEBHOOK_SECRET,
  });

  if (!sigCheck.valid) {
    if (REQUIRE_SIGNATURE) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.warn("Ghana-Rails webhook signature missing/invalid; bearer-only mode", {
      reason: sigCheck.reason,
    });
  }

  let body: GhanaRailsWebhookPayload;
  try {
    body = JSON.parse(rawBody) as GhanaRailsWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { provider_transaction_id, status, metadata } = body;
  if (!provider_transaction_id || !status) {
    return NextResponse.json(
      { error: "provider_transaction_id and status are required" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const eventType = body.type || "ghana_rails.payment_status";
  const eventId =
    body.id?.toString() ||
    body.event_id?.toString() ||
    `${eventType}:${provider_transaction_id}:${status}`;

  // 4. Atomic acquire (claim-or-reclaim) before any payment lookup. A row is
  //    only 'processed' after the full path below succeeds, so a post-claim
  //    failure leaves the event reclaimable and the retry reprocesses.
  let acquire;
  try {
    acquire = await acquireWebhookEvent(supabase, {
      provider: "ghana_rails",
      eventId,
      eventType,
      payload: body as unknown as Record<string, unknown>,
    });
  } catch (err) {
    logger.error("Ghana-Rails webhook acquire failed", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
  if (acquire.result === "duplicate_processed") {
    return NextResponse.json({ message: "Duplicate webhook ignored", duplicate: true }, { status: 200 });
  }
  if (acquire.result === "dead") {
    logger.error("Ghana-Rails webhook event exceeded max attempts; marked dead", {
      event_id: eventId,
      attempts: acquire.attempts,
    });
    return NextResponse.json({ message: "Webhook given up", dead: true }, { status: 200 });
  }
  if (acquire.result === "in_flight") {
    return NextResponse.json({ error: "Webhook already being processed" }, { status: 503 });
  }
  // acquire.result === "acquired" → process it.

  // 5. Look up payment. Failures mark the event failed (not processed) so it is
  //    reprocessed on retry.
  const { data: payment, error } = await supabase
    .from("payments")
    .select("*")
    .eq("provider_transaction_id", provider_transaction_id)
    .single();

  if (error || !payment) {
    await markWebhookFailed(supabase, "ghana_rails", eventId, "payment_not_found");
    return NextResponse.json({ error: "Payment not found" }, { status: 503 });
  }

  const paymentRecord = payment as any;
  if (paymentRecord.provider !== "custom") {
    await markWebhookFailed(supabase, "ghana_rails", eventId, "provider_mismatch");
    return NextResponse.json({ error: "Invalid provider for this webhook" }, { status: 409 });
  }

  const nextStatus =
    status === "completed" ? "completed" : status === "failed" ? "failed" : "pending";

  const dedupeEventId = `ghana_rails:${eventId}`;
  const mergedMetadata = buildWebhookMetadata(
    paymentRecord.metadata as Record<string, any> | null | undefined,
    dedupeEventId,
    eventType,
    {
      provider_status: status,
      provider_webhook_received_at: new Date().toISOString(),
      provider_webhook_payload: metadata || {},
    }
  );

  // 6. Process, then mark processed ONLY after the FULL path (incl. appointment)
  //    succeeds. Any throw → mark failed + 5xx → retry reprocesses.
  try {
    const { error: updateError } = await supabase
      .from("payments")
      .update({
        status: nextStatus,
        metadata: mergedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("provider_transaction_id", provider_transaction_id);
    if (updateError) {
      throw new Error(`Ghana-Rails payment update failed: ${updateError.message}`);
    }

    if (nextStatus === "completed") {
      const { data: updatedPayment } = await supabase
        .from("payments")
        .select("*")
        .eq("id", paymentRecord.id)
        .single();
      if (updatedPayment) {
        await ensureAppointmentForCompletedPayment(supabase, updatedPayment);
      }
    }

    await markWebhookProcessed(supabase, "ghana_rails", eventId);
    return NextResponse.json({ message: "Payment updated", status: nextStatus });
  } catch (err: any) {
    logger.error("Ghana-Rails webhook processing failed", err);
    await markWebhookFailed(supabase, "ghana_rails", eventId, err?.message ?? String(err));
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
