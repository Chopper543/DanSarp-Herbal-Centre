import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { paymentService } from "@/lib/payments/payment-service";
import { PaystackProvider } from "@/lib/payments/providers/paystack";
import { FlutterwaveProvider } from "@/lib/payments/providers/flutterwave";
import { GhanaRailsProvider } from "@/lib/payments/providers/ghana-rails";

// Register payment providers
paymentService.registerProvider("paystack", new PaystackProvider());
paymentService.registerProvider("flutterwave", new FlutterwaveProvider());
paymentService.registerProvider("custom", new GhanaRailsProvider());

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { amount, currency, payment_method, appointment_id, provider } = body;

    // Determine provider based on payment method
    let selectedProvider = provider || "paystack";
    if (["mtn_momo", "vodafone_cash", "airteltigo", "bank_transfer", "ghqr"].includes(payment_method)) {
      selectedProvider = "custom";
    }

    // Get user email for payment
    // @ts-ignore - Supabase type inference issue with users table
    const { data: userData } = await supabase
      .from("users")
      .select("email, full_name")
      .eq("id", user.id)
      .single();
    
    const typedUserData = userData as { email: string; full_name: string | null } | null;

    // Process payment
    const paymentResponse = await paymentService.processPayment(selectedProvider, {
      amount,
      currency: currency || "GHS",
      payment_method,
      user_id: user.id,
      appointment_id,
      metadata: {
        email: typedUserData?.email,
        name: typedUserData?.full_name,
      },
    });

    // Create payment record
    // @ts-ignore - Supabase type inference issue with payments table
    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        user_id: user.id,
        appointment_id: appointment_id || null,
        amount,
        currency: currency || "GHS",
        payment_method,
        status: paymentResponse.status,
        provider: selectedProvider,
        provider_transaction_id: paymentResponse.provider_transaction_id,
        metadata: paymentResponse.metadata,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      payment,
      payment_url: paymentResponse.payment_url,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get("id");

    if (paymentId) {
      const { data: payment, error } = await supabase
        .from("payments")
        .select("*")
        .eq("id", paymentId)
        .eq("user_id", user.id)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ payment }, { status: 200 });
    }

    // Get all payments for user
    const { data: payments, error } = await supabase
      .from("payments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ payments }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
