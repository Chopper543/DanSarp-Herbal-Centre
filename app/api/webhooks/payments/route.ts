import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { paymentService } from "@/lib/payments/payment-service";
import { sendEmail } from "@/lib/email/resend";
import { validateRequestSize, getMaxSizeForContentType } from "@/lib/utils/validate-request-size";
import crypto from "crypto";
import { logger } from "@/lib/monitoring/logger";
import { verifyFlutterwaveSignature } from "@/lib/payments/webhook-signature";
import {
  buildWebhookMetadata,
  getProcessedWebhookEventIds,
  resolveWebhookEventId,
  resolveWebhookEventType,
} from "@/lib/payments/webhook-idempotency";

async function findPaymentByProviderRefs(
  supabase: any,
  references: Array<string | null | undefined>
) {
  const seen = new Set<string>();
  for (const reference of references) {
    const ref = reference?.toString().trim();
    if (!ref || seen.has(ref)) {
      continue;
    }
    seen.add(ref);

    // @ts-ignore - Supabase type inference issue
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("provider_transaction_id", ref)
      .maybeSingle();

    if (data) {
      return data;
    }
  }

  return null;
}

async function createAppointmentFromPayment(supabase: any, payment: any) {
  // Check if payment has appointment_data in metadata
  const metadata = payment.metadata as any;
  if (!metadata?.appointment_data) {
    return null;
  }

  const appointmentData = metadata.appointment_data;
  const userId = payment.user_id;

  // Check if appointment already exists for this payment
  if (payment.appointment_id) {
    return null; // Appointment already created
  }

  // Verify payment is completed
  if (payment.status !== 'completed') {
    return null;
  }

  // Optional toggle to enable/disable auto creation
  if (metadata.appointment_data.auto_create === false) {
    return null;
  }

  try {
    // Create appointment
    // @ts-ignore - Supabase type inference issue
    const { data: appointment, error } = await supabase
      .from("appointments")
      // @ts-ignore - Supabase type inference issue
      .insert({
        user_id: userId,
        branch_id: appointmentData.branch_id,
        appointment_date: appointmentData.appointment_date,
        treatment_type: appointmentData.treatment_type,
        notes: appointmentData.notes || null,
        status: "pending",
      })
      .select()
      .single();

    if (error || !appointment) {
      logger.error("Failed to create appointment from payment", error);
      return null;
    }

    // Link payment to appointment
    // @ts-ignore - Supabase type inference issue
    const { error: linkError } = await supabase
      .from("payments")
      // @ts-ignore - Supabase type inference issue
      .update({ appointment_id: appointment.id })
      .eq("id", payment.id);

    if (linkError) {
      // Roll back appointment to keep data consistent
      // @ts-ignore - Supabase type inference issue with appointments table
      await supabase.from("appointments").delete().eq("id", appointment.id);
      logger.error("Failed to link payment to appointment", linkError);
      return null;
    }

    return appointment;
  } catch (error) {
    logger.error("Error creating appointment from payment", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const sizeCheck = await validateRequestSize(
      request,
      getMaxSizeForContentType(request.headers.get("content-type"))
    );
    if (sizeCheck) {
      return sizeCheck;
    }

    // Get raw body for signature verification (Paystack requires raw body)
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // Determine transaction id and fetch payment to anchor provider
    const paystackRef = body?.data?.reference;
    const flutterwaveRef = body?.data?.tx_ref?.toString();
    const flutterwaveId = body?.data?.id?.toString();
    const incomingEvent = resolveWebhookEventType(body);

    const providerTransactionId = paystackRef || flutterwaveRef || flutterwaveId;
    if (!providerTransactionId) {
      return NextResponse.json({ error: "Missing transaction reference" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch the persisted payment to get trusted provider
    const payment = await findPaymentByProviderRefs(supabase, [
      providerTransactionId,
      flutterwaveRef,
      flutterwaveId,
    ]);

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const paymentRecord = payment as any;
    const provider = paymentRecord.provider;
    if (!["paystack", "flutterwave"].includes(provider)) {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    const webhookEventId = resolveWebhookEventId(
      provider as "paystack" | "flutterwave",
      body,
      incomingEvent,
      providerTransactionId
    );
    if (getProcessedWebhookEventIds(paymentRecord.metadata).includes(webhookEventId)) {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }

    let webhookEventRecorded = false;

  // Verify webhook signature (must happen before any processing)
  if (provider === "paystack") {
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
      logger.error("PAYSTACK_SECRET_KEY not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const hash = crypto
      .createHmac("sha512", paystackSecret)
      .update(rawBody)
      .digest("hex");

    if (hash !== request.headers.get("x-paystack-signature")) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  if (provider === "flutterwave") {
    try {
      const flutterwaveSignature =
        request.headers.get("flutterwave-signature") || request.headers.get("verif-hash");
      const valid = verifyFlutterwaveSignature(
        rawBody,
        flutterwaveSignature,
        process.env.FLUTTERWAVE_SECRET_HASH
      );
      if (!valid) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

    // Process webhook based on provider
    // Handle Paystack events (including mobile money)
    if (provider === "paystack") {
      // Handle charge.success (for mobile money and other payment methods)
      if (incomingEvent === "charge.success") {
        const transactionRef = paystackRef;
        
        // Verify payment
        const paymentResponse = await paymentService.verifyPayment(
          "paystack",
          transactionRef
        );

        // Get payment record
        // Update payment status (idempotent-ish: only update if changed)
        if (paymentResponse.status !== paymentRecord.status) {
          // @ts-ignore - Supabase type inference issue with payments table
          await supabase
            .from("payments")
            // @ts-ignore - Supabase type inference issue with payments table
            .update({
              status: paymentResponse.status,
              metadata: buildWebhookMetadata(
                paymentResponse.metadata || paymentRecord.metadata,
                webhookEventId,
                incomingEvent,
                { paystack_webhook_payload: body }
              ),
              updated_at: new Date().toISOString(),
            })
            .eq("provider_transaction_id", transactionRef);
          webhookEventRecorded = true;
        }

        // If payment is completed and has appointment_data, create appointment
        if (paymentResponse.status === 'completed') {
          // @ts-ignore - Supabase type inference issue
          const { data: updatedPayment } = await supabase
            .from("payments")
            .select("*, users!payments_user_id_fkey(email)")
            .eq("provider_transaction_id", transactionRef)
            .single();
          
          if (updatedPayment) {
            await createAppointmentFromPayment(supabase, updatedPayment);
            const userEmail = (updatedPayment as any)?.users?.email;
            if (userEmail) {
              // Fire-and-forget notification
              sendEmail({
                to: userEmail,
                subject: "Payment received",
                html: `<p>Your payment (${paymentResponse.metadata?.reference_code || transactionRef}) was completed successfully.</p>`,
              }).catch(() => {});
            }
          }
        }
      }

      // Handle charge.failed for mobile money
      if (incomingEvent === "charge.failed") {
        const transactionRef = paystackRef;
        
        // @ts-ignore - Supabase type inference issue with payments table
        await supabase
          .from("payments")
          // @ts-ignore - Supabase type inference issue with payments table
          .update({
            status: "failed",
            metadata: buildWebhookMetadata(paymentRecord.metadata, webhookEventId, incomingEvent, {
              paystack_webhook_payload: body.data,
            }),
          })
          .eq("provider_transaction_id", transactionRef);
        webhookEventRecorded = true;
      }
    }

    if (provider === "flutterwave" && incomingEvent === "charge.completed") {
      const transactionRef = flutterwaveRef || flutterwaveId;
      if (!transactionRef) {
        return NextResponse.json(
          { error: "Missing Flutterwave transaction reference" },
          { status: 400 }
        );
      }
      
      // Verify payment
      const paymentResponse = await paymentService.verifyPayment(
        "flutterwave",
        transactionRef
      );

      // Update payment status
      // @ts-ignore - Supabase type inference issue with payments table
      await supabase
        .from("payments")
        // @ts-ignore - Supabase type inference issue with payments table
        .update({
          status: paymentResponse.status,
          metadata: buildWebhookMetadata(
            paymentResponse.metadata || paymentRecord.metadata,
            webhookEventId,
            incomingEvent,
            { flutterwave_webhook_payload: body }
          ),
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentRecord.id);
      webhookEventRecorded = true;

      // If payment is completed and has appointment_data, create appointment
      if (paymentResponse.status === 'completed') {
        // @ts-ignore - Supabase type inference issue
        const { data: updatedPayment } = await supabase
          .from("payments")
          .select("*, users!payments_user_id_fkey(email)")
          .eq("id", paymentRecord.id)
          .single();
        
        if (updatedPayment) {
          await createAppointmentFromPayment(supabase, updatedPayment);
          const userEmail = (updatedPayment as any)?.users?.email;
          if (userEmail) {
            sendEmail({
              to: userEmail,
              subject: "Payment received",
              html: `<p>Your payment (${paymentResponse.metadata?.reference_code || transactionRef}) was completed successfully.</p>`,
            }).catch(() => {});
          }
        }
      }
    }

    // Record idempotency marker even if no payment status transition occurred.
    if (!webhookEventRecorded) {
      await supabase
        .from("payments")
        // @ts-ignore - Supabase type inference issue with payments table
        .update({
          metadata: buildWebhookMetadata(
            paymentRecord.metadata,
            webhookEventId,
            incomingEvent,
            { webhook_received_without_state_change: true }
          ),
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentRecord.id);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    logger.error("Webhook error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
