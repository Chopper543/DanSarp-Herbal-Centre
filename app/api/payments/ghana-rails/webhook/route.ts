import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/monitoring/logger";
import {
  buildWebhookMetadata,
  getProcessedWebhookEventIds,
} from "@/lib/payments/webhook-idempotency";

const WEBHOOK_SECRET = process.env.GHANA_RAILS_WEBHOOK_SECRET;
const supabaseAdmin = (() => {
  try {
    return createServiceClient();
  } catch {
    return null;
  }
})();

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
  if (!metadata?.appointment_data || payment.appointment_id || payment.status !== "completed") {
    return null;
  }

  if (metadata.appointment_data.auto_create === false) {
    return null;
  }

  const appointmentData = metadata.appointment_data;

  // @ts-ignore - Supabase type inference issue
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

  // @ts-ignore - Supabase type inference issue
  const { error: linkError } = await supabase
    .from("payments")
    .update({ appointment_id: appointment.id })
    .eq("id", payment.id);

  if (linkError) {
    // @ts-ignore - Supabase type inference issue
    await supabase.from("appointments").delete().eq("id", appointment.id);
    logger.error("Failed to link Ghana rails payment to appointment", linkError);
    return null;
  }

  return appointment;
}

export async function POST(request: NextRequest) {
  try {
    if (!WEBHOOK_SECRET || !supabaseAdmin) {
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as GhanaRailsWebhookPayload;
    const { provider_transaction_id, status, metadata } = body;

    if (!provider_transaction_id || !status) {
      return NextResponse.json({ error: "provider_transaction_id and status are required" }, { status: 400 });
    }

    // Lookup payment by provider transaction id
    const { data: payment, error } = await supabaseAdmin
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

    const eventType = body.type || "ghana_rails.payment_status";
    const eventId =
      body.id?.toString() ||
      body.event_id?.toString() ||
      `${eventType}:${provider_transaction_id}:${status}`;
    const dedupeEventId = `ghana_rails:${eventId}`;
    if (getProcessedWebhookEventIds(paymentRecord.metadata).includes(dedupeEventId)) {
      return NextResponse.json({ message: "Duplicate webhook ignored", duplicate: true }, { status: 200 });
    }

    const nextStatus =
      status === "completed"
        ? "completed"
        : status === "failed"
          ? "failed"
          : "pending";

    // Merge metadata and persist provider status for later verification
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

    const { error: updateError } = await supabaseAdmin
      .from("payments")
      // @ts-ignore - Supabase type inference issue
      .update({
        status: nextStatus,
        metadata: mergedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("provider_transaction_id", provider_transaction_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    if (nextStatus === "completed") {
      // Re-fetch latest payment record (including merged metadata) and create appointment if needed.
      // @ts-ignore - Supabase type inference issue
      const { data: updatedPayment } = await supabaseAdmin
        .from("payments")
        .select("*")
        .eq("id", paymentRecord.id)
        .single();

      if (updatedPayment) {
        await createAppointmentFromPayment(supabaseAdmin, updatedPayment);
      }
    }

    return NextResponse.json({ message: "Payment updated", status: nextStatus });
  } catch (error: any) {
    logger.error("Ghana rails webhook error", error);
    return NextResponse.json(
      { error: error?.message || "Webhook processing failed" },
      { status: 500 }
    );
  }
}
