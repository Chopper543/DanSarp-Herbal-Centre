import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { paymentService } from "@/lib/payments/payment-service";
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

  // Verify payment is completed and amount is 100 GHS
  if (payment.status !== 'completed' || parseFloat(payment.amount.toString()) !== 100) {
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
    const body = await request.json();
    const provider = request.headers.get("x-provider") || "paystack";

    // Verify webhook signature (implement based on provider)
    // For Paystack:
    if (provider === "paystack") {
      const hash = crypto
        .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY || "")
        .update(JSON.stringify(body))
        .digest("hex");

      if (hash !== request.headers.get("x-paystack-signature")) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // Process webhook based on provider
    const supabase = await createClient();

    if (provider === "paystack" && body.event === "charge.success") {
      const transactionRef = body.data.reference;
      
      // Verify payment
      const paymentResponse = await paymentService.verifyPayment(
        "paystack",
        transactionRef
      );

      // Get payment record
      // @ts-ignore - Supabase type inference issue
      const { data: payment } = await supabase
        .from("payments")
        .select("*")
        .eq("provider_transaction_id", transactionRef)
        .single();

      // Update payment status
      // @ts-ignore - Supabase type inference issue with payments table
      await supabase
        .from("payments")
        // @ts-ignore - Supabase type inference issue with payments table
        .update({
          status: paymentResponse.status,
          metadata: paymentResponse.metadata,
        })
        .eq("provider_transaction_id", transactionRef);

      // If payment is completed and has appointment_data, create appointment
      if (payment && paymentResponse.status === 'completed') {
        // @ts-ignore - Supabase type inference issue
        const { data: updatedPayment } = await supabase
          .from("payments")
          .select("*")
          .eq("provider_transaction_id", transactionRef)
          .single();
        
        if (updatedPayment) {
          await createAppointmentFromPayment(supabase, updatedPayment);
        }
      }
    }

    if (provider === "flutterwave" && body.event === "charge.completed") {
      const transactionId = body.data.id.toString();
      
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
        })
        .eq("provider_transaction_id", transactionId);

      // If payment is completed and has appointment_data, create appointment
      if (payment && paymentResponse.status === 'completed') {
        // @ts-ignore - Supabase type inference issue
        const { data: updatedPayment } = await supabase
          .from("payments")
          .select("*")
          .eq("provider_transaction_id", transactionId)
          .single();
        
        if (updatedPayment) {
          await createAppointmentFromPayment(supabase, updatedPayment);
        }
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
