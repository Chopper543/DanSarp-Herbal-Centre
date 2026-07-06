import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/monitoring/logger";
import { buildWebhookMetadata } from "@/lib/payments/webhook-idempotency";
import { claimWebhookEvent } from "@/lib/payments/webhook-events";
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

async function createAppointmentFromPayment(supabase: any, payment: any) {
  const metadata = payment.metadata as any;
  if (
    !metadata?.appointment_data ||
    payment.appointment_id ||
    payment.status !== "completed" ||
    metadata.appointment_data.auto_create === false
  ) {
    return null;
  }

  const appointmentData = metadata.appointment_data;

  const { data: appointment, error: createError } = await supabase
    .from("appointments")
    .insert({
      user_id: payment.user_id,
      branch_id: appointmentData.branch_id,
      appointment_date: appointmentData.appointment_date,
      treatment_type: appointmentData.treatment_type,
      notes: appointmentData.notes || null,
      status: "pending",
    })
    .select()
    .single();

  if (createError || !appointment) {
    logger.error("Failed to create appointment from Ghana rails payment", createError);
    return null;
  }

  const { error: linkError } = await supabase
    .from("payments")
    .update({ appointment_id: appointment.id })
    .eq("id", payment.id);

  if (linkError) {
    await supabase.from("appointments").delete().eq("id", appointment.id);
    logger.error("Failed to link Ghana rails payment to appointment", linkError);
    return null;
  }

  return appointment;
}

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

  // 4. Atomic dedup before any payment lookup. Same insert-first pattern as
  //    the Paystack/Flutterwave router.
  try {
    const claim = await claimWebhookEvent(supabase, {
      provider: "ghana_rails",
      eventId,
      eventType,
      payload: body as unknown as Record<string, unknown>,
    });
    if (claim.duplicate) {
      return NextResponse.json(
        { message: "Duplicate webhook ignored", duplicate: true },
        { status: 200 }
      );
    }
  } catch (err) {
    logger.error("Ghana-Rails webhook claim failed", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  // 5. Look up payment and apply update.
  const { data: payment, error } = await supabase
    .from("payments")
    .select("*")
    .eq("provider_transaction_id", provider_transaction_id)
    .single();

  if (error || !payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const paymentRecord = payment as any;
  if (paymentRecord.provider !== "custom") {
    return NextResponse.json({ error: "Invalid provider for this webhook" }, { status: 400 });
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

  const { error: updateError } = await supabase
    .from("payments")
    .update({
      status: nextStatus,
      metadata: mergedMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq("provider_transaction_id", provider_transaction_id);

  if (updateError) {
    logger.error("Ghana-Rails payment update failed", updateError);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  if (nextStatus === "completed") {
    const { data: updatedPayment } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentRecord.id)
      .single();

    if (updatedPayment) {
      try {
        await createAppointmentFromPayment(supabase, updatedPayment);
      } catch (err) {
        logger.error("Ghana-Rails appointment creation failed", err);
      }
    }
  }

  return NextResponse.json({ message: "Payment updated", status: nextStatus });
}
