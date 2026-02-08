import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { paymentService } from "@/lib/payments/payment-service";
import { sendEmail } from "@/lib/email/resend";
import crypto from "crypto";

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
      console.error("Failed to create appointment from payment:", error);
      return null;
    }

    // Link payment to appointment
    // @ts-ignore - Supabase type inference issue
    await supabase
      .from("payments")
      // @ts-ignore - Supabase type inference issue
      .update({ appointment_id: appointment.id })
      .eq("id", payment.id);

    return appointment;
  } catch (error) {
    console.error("Error creating appointment from payment:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification (Paystack requires raw body)
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // Determine transaction id and fetch payment to anchor provider
    const paystackRef = body?.data?.reference;
    const flutterwaveId = body?.data?.id?.toString();
    const incomingEvent = body?.event;
    const incomingProviderHeader = request.headers.get("x-provider") || "";

    const providerTransactionId = paystackRef || flutterwaveId;
    if (!providerTransactionId) {
      return NextResponse.json({ error: "Missing transaction reference" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch the persisted payment to get trusted provider
    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("provider_transaction_id", providerTransactionId)
      .single();

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const provider = payment.provider;
    if (!["paystack", "flutterwave"].includes(provider)) {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    // Verify webhook signature (implement based on provider)
    if (provider === "paystack") {
      const hash = crypto
        .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY || "")
        .update(rawBody)
        .digest("hex");

      if (hash !== request.headers.get("x-paystack-signature")) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
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
        if (paymentResponse.status !== payment.status) {
          // @ts-ignore - Supabase type inference issue with payments table
          await supabase
            .from("payments")
            // @ts-ignore - Supabase type inference issue with payments table
            .update({
              status: paymentResponse.status,
              metadata: paymentResponse.metadata,
              updated_at: new Date().toISOString(),
            })
            .eq("provider_transaction_id", transactionRef);
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
            metadata: body.data,
          })
          .eq("provider_transaction_id", transactionRef);
      }
    }

    // Verify Flutterwave webhook signature
    if (provider === "flutterwave") {
      const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;
      if (secretHash) {
        const signature = request.headers.get("verif-hash");
        if (!signature) {
          return NextResponse.json({ error: "Missing signature" }, { status: 401 });
        }

        // Flutterwave uses SHA512 hash of raw body with secret hash
        const hash = crypto
          .createHmac("sha512", secretHash)
          .update(rawBody)
          .digest("hex");

        if (hash !== signature) {
          return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
      }
    }

    if (provider === "flutterwave" && incomingEvent === "charge.completed") {
      const transactionId = flutterwaveId;
      
      // Verify payment
      const paymentResponse = await paymentService.verifyPayment(
        "flutterwave",
        transactionId
      );

      // Get payment record
      // @ts-ignore - Supabase type inference issue
      const { data: payment } = await supabase
        .from("payments")
        .select("*")
        .eq("provider_transaction_id", transactionId)
        .single();

      // Update payment status
      // @ts-ignore - Supabase type inference issue with payments table
      await supabase
        .from("payments")
        // @ts-ignore - Supabase type inference issue with payments table
        .update({
          status: paymentResponse.status,
          metadata: paymentResponse.metadata,
          updated_at: new Date().toISOString(),
        })
        .eq("provider_transaction_id", transactionId);

      // If payment is completed and has appointment_data, create appointment
      if (payment && paymentResponse.status === 'completed') {
        // @ts-ignore - Supabase type inference issue
        const { data: updatedPayment } = await supabase
          .from("payments")
          .select("*, users!payments_user_id_fkey(email)")
          .eq("provider_transaction_id", transactionId)
          .single();
        
        if (updatedPayment) {
          await createAppointmentFromPayment(supabase, updatedPayment);
          const userEmail = (updatedPayment as any)?.users?.email;
          if (userEmail) {
            sendEmail({
              to: userEmail,
              subject: "Payment received",
              html: `<p>Your payment (${paymentResponse.metadata?.reference_code || transactionId}) was completed successfully.</p>`,
            }).catch(() => {});
          }
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
