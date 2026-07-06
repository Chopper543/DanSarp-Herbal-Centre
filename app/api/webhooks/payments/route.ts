import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { paymentService } from "@/lib/payments/payment-service";
import { sendEmail } from "@/lib/email/resend";
import { validateRequestSize, getMaxSizeForContentType } from "@/lib/utils/validate-request-size";
import { logger } from "@/lib/monitoring/logger";
import {
  verifyFlutterwaveSignature,
  verifyPaystackSignature,
} from "@/lib/payments/webhook-signature";
import {
  buildWebhookMetadata,
  resolveWebhookEventId,
  resolveWebhookEventType,
} from "@/lib/payments/webhook-idempotency";
import { claimWebhookEvent, type WebhookProvider } from "@/lib/payments/webhook-events";
import { reconcilePaymentAmount } from "@/lib/payments/amount-reconciliation";

type DetectedProvider = Extract<WebhookProvider, "paystack" | "flutterwave">;

/**
 * Provider must come from the request itself, not from a DB lookup keyed by
 * a body-supplied transaction reference. Trusting the body would let an
 * attacker submit a Paystack `reference` and route it through Flutterwave's
 * signature scheme (or vice-versa) to bypass verification.
 *
 * `verif-hash` is Flutterwave's legacy header name (still seen in the wild);
 * `flutterwave-signature` is the current one. Either is sufficient to claim
 * "this is a Flutterwave hook" — verification still runs against the
 * Flutterwave secret.
 */
function detectProviderFromHeaders(request: NextRequest): {
  provider: DetectedProvider | null;
  signature: string | null;
} {
  const paystackSig = request.headers.get("x-paystack-signature");
  if (paystackSig) {
    return { provider: "paystack", signature: paystackSig };
  }

  const flutterwaveSig =
    request.headers.get("flutterwave-signature") || request.headers.get("verif-hash");
  if (flutterwaveSig) {
    return { provider: "flutterwave", signature: flutterwaveSig };
  }

  return { provider: null, signature: null };
}

function verifySignature(
  provider: DetectedProvider,
  rawBody: string,
  signature: string
): boolean {
  if (provider === "paystack") {
    return verifyPaystackSignature(rawBody, signature, process.env.PAYSTACK_SECRET_KEY);
  }
  return verifyFlutterwaveSignature(rawBody, signature, process.env.FLUTTERWAVE_SECRET_HASH);
}

async function findPaymentByProviderRefs(
  supabase: any,
  references: Array<string | null | undefined>
) {
  const seen = new Set<string>();
  for (const reference of references) {
    const ref = reference?.toString().trim();
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("provider_transaction_id", ref)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

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

  try {
    const { data: appointment, error } = await supabase
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

    if (error || !appointment) {
      logger.error("Failed to create appointment from payment", error);
      return null;
    }

    const { error: linkError } = await supabase
      .from("payments")
      .update({ appointment_id: appointment.id })
      .eq("id", payment.id);

    if (linkError) {
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
  // 1. Detect provider from request headers BEFORE touching the body or DB.
  //    Unsigned requests get a generic 401 — no DB probing surface.
  const { provider, signature } = detectProviderFromHeaders(request);
  if (!provider || !signature) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Size guard. Middleware skips this for webhook paths, so the route owns it.
  const sizeCheck = await validateRequestSize(
    request,
    getMaxSizeForContentType(request.headers.get("content-type"))
  );
  if (sizeCheck) return sizeCheck;

  // 3. Verify signature against the raw body. Anything below this line runs
  //    with a verified payload from the provider — never trust unsigned input.
  const rawBody = await request.text();
  let signatureValid: boolean;
  try {
    signatureValid = verifySignature(provider, rawBody, signature);
  } catch (err: any) {
    logger.error("Webhook signature verification misconfigured", err);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  if (!signatureValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 4. Parse + resolve identifiers from the verified body.
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const incomingEvent = resolveWebhookEventType(body);
  const paystackRef = body?.data?.reference;
  const flutterwaveRef = body?.data?.tx_ref?.toString();
  const flutterwaveId = body?.data?.id?.toString();
  const providerTransactionId = paystackRef || flutterwaveRef || flutterwaveId;
  if (!providerTransactionId) {
    return NextResponse.json({ error: "Missing transaction reference" }, { status: 400 });
  }

  const webhookEventId = resolveWebhookEventId(
    provider,
    body,
    incomingEvent,
    providerTransactionId
  );

  const supabase = createServiceClient();

  // 5. Atomic dedup. The unique constraint on (provider, event_id) makes the
  //    INSERT itself the gate — concurrent retries from the provider can't
  //    both pass this check.
  try {
    const claim = await claimWebhookEvent(supabase, {
      provider,
      eventId: webhookEventId,
      eventType: incomingEvent,
      payload: body,
    });
    if (claim.duplicate) {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }
  } catch (err) {
    logger.error("Webhook claim failed", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  // 6. Now look up the payment. By this point we know the request is signed,
  //    the event is novel, and we have a verified transaction reference.
  const payment = await findPaymentByProviderRefs(supabase, [
    providerTransactionId,
    flutterwaveRef,
    flutterwaveId,
  ]);
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const paymentRecord = payment as any;

  // 7. Provider mismatch defense. The signed payload told us the provider via
  //    the header; the payment row also records its provider. If they disagree,
  //    one of them is wrong — refuse to process rather than guess.
  if (paymentRecord.provider !== provider) {
    logger.warn("Webhook provider/payment provider mismatch", {
      header_provider: provider,
      payment_provider: paymentRecord.provider,
      payment_id: paymentRecord.id,
    });
    return NextResponse.json({ error: "Provider mismatch" }, { status: 401 });
  }

  try {
    await backfillPaymentFromWebhook(supabase, provider, body, paymentRecord, webhookEventId, incomingEvent);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    logger.error("Webhook processing failed", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function backfillPaymentFromWebhook(
  supabase: any,
  provider: DetectedProvider,
  body: any,
  paymentRecord: any,
  webhookEventId: string,
  incomingEvent: string | null
) {
  let webhookEventRecorded = false;

  if (provider === "paystack") {
    const paystackRef = body?.data?.reference;
    if (incomingEvent === "charge.success") {
      const paymentResponse = await paymentService.verifyPayment("paystack", paystackRef);

      // Reconcile the provider-verified amount/currency before allowing a
      // "completed" transition. Never auto-complete an unreconciled payment.
      const reconciliation =
        paymentResponse.status === "completed"
          ? reconcilePaymentAmount("paystack", paymentResponse.metadata, paymentRecord)
          : null;
      const completionWithheld = reconciliation != null && !reconciliation.ok;
      if (completionWithheld) {
        logger.error("Paystack amount reconciliation failed; withholding completion", {
          payment_id: paymentRecord.id,
          provider_transaction_id: paystackRef,
          ...reconciliation,
        });
      }
      const effectiveStatus = completionWithheld ? "pending" : paymentResponse.status;

      if (effectiveStatus !== paymentRecord.status || completionWithheld) {
        await supabase
          .from("payments")
          .update({
            status: effectiveStatus,
            metadata: buildWebhookMetadata(
              paymentResponse.metadata || paymentRecord.metadata,
              webhookEventId,
              incomingEvent,
              {
                paystack_webhook_payload: body,
                ...(reconciliation
                  ? {
                      amount_reconciliation: reconciliation,
                      requires_manual_review: completionWithheld,
                    }
                  : {}),
              }
            ),
            updated_at: new Date().toISOString(),
          })
          .eq("provider_transaction_id", paystackRef);
        webhookEventRecorded = true;
      }

      if (effectiveStatus === "completed") {
        const { data: updatedPayment } = await supabase
          .from("payments")
          .select("*, users!payments_user_id_fkey(email)")
          .eq("provider_transaction_id", paystackRef)
          .single();

        if (updatedPayment) {
          await createAppointmentFromPayment(supabase, updatedPayment);
          const userEmail = (updatedPayment as any)?.users?.email;
          if (userEmail) {
            sendEmail({
              to: userEmail,
              subject: "Payment received",
              html: `<p>Your payment (${paymentResponse.metadata?.reference_code || paystackRef}) was completed successfully.</p>`,
            }).catch(() => {});
          }
        }
      }
    }

    if (incomingEvent === "charge.failed") {
      await supabase
        .from("payments")
        .update({
          status: "failed",
          metadata: buildWebhookMetadata(paymentRecord.metadata, webhookEventId, incomingEvent, {
            paystack_webhook_payload: body.data,
          }),
        })
        .eq("provider_transaction_id", paystackRef);
      webhookEventRecorded = true;
    }
  }

  if (provider === "flutterwave" && incomingEvent === "charge.completed") {
    const flutterwaveRef = body?.data?.tx_ref?.toString();
    const flutterwaveId = body?.data?.id?.toString();
    const transactionRef = flutterwaveRef || flutterwaveId;
    if (!transactionRef) {
      throw new Error("Missing Flutterwave transaction reference");
    }

    const paymentResponse = await paymentService.verifyPayment("flutterwave", transactionRef);

    const reconciliation =
      paymentResponse.status === "completed"
        ? reconcilePaymentAmount("flutterwave", paymentResponse.metadata, paymentRecord)
        : null;
    const completionWithheld = reconciliation != null && !reconciliation.ok;
    if (completionWithheld) {
      logger.error("Flutterwave amount reconciliation failed; withholding completion", {
        payment_id: paymentRecord.id,
        provider_transaction_id: transactionRef,
        ...reconciliation,
      });
    }
    const effectiveStatus = completionWithheld ? "pending" : paymentResponse.status;

    await supabase
      .from("payments")
      .update({
        status: effectiveStatus,
        metadata: buildWebhookMetadata(
          paymentResponse.metadata || paymentRecord.metadata,
          webhookEventId,
          incomingEvent,
          {
            flutterwave_webhook_payload: body,
            ...(reconciliation
              ? {
                  amount_reconciliation: reconciliation,
                  requires_manual_review: completionWithheld,
                }
              : {}),
          }
        ),
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRecord.id);
    webhookEventRecorded = true;

    if (effectiveStatus === "completed") {
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

  if (!webhookEventRecorded) {
    await supabase
      .from("payments")
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
}
