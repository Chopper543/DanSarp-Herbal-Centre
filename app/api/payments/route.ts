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
    const { 
      amount, 
      currency, 
      payment_method, 
      appointment_id, 
      provider, 
      appointment_data,
      // Mobile Money fields
      phone_number,
      // Bank Transfer fields
      bank_name,
      account_number,
      bank_notes,
      // Card Payment fields
      card_number,
      card_expiry,
      card_name,
      card_pin
    } = body;

    // Determine provider based on payment method
    let selectedProvider = provider || "paystack";
    // Use Paystack for mobile money payments
    // Only use custom provider for bank_transfer and ghqr
    if (["bank_transfer", "ghqr"].includes(payment_method)) {
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

    // Build metadata with appointment data if provided
    const metadata: Record<string, any> = {
      email: typedUserData?.email,
      name: typedUserData?.full_name,
    };

    // Include appointment data in metadata if provided (for booking fee payments)
    if (appointment_data) {
      metadata.appointment_data = appointment_data;
    }

    // Include method-specific data in metadata
    if (phone_number) {
      metadata.phone_number = phone_number;
    }
    if (bank_name) {
      metadata.bank_name = bank_name;
      metadata.account_number = account_number;
      if (bank_notes) {
        metadata.bank_notes = bank_notes;
      }
    }
    if (card_number) {
      // Don't store full card number or PIN in metadata for security
      // Only store last 4 digits and card type
      metadata.card_last4 = card_number.slice(-4);
      metadata.card_expiry = card_expiry;
      metadata.card_name = card_name;
      // Card PIN should only be passed to payment gateway, never stored
    }

    // Process payment with method-specific data
    const paymentRequest: any = {
      amount,
      currency: currency || "GHS",
      payment_method,
      user_id: user.id,
      appointment_id,
      metadata,
    };

    // Add method-specific fields to payment request
    if (phone_number) {
      paymentRequest.phone_number = phone_number;
    }
    if (card_number && card_expiry && card_name && card_pin) {
      // Pass card details to payment provider (will be handled securely)
      paymentRequest.card_number = card_number;
      paymentRequest.card_expiry = card_expiry;
      paymentRequest.card_name = card_name;
      paymentRequest.card_pin = card_pin;
    }
    if (bank_name && account_number) {
      paymentRequest.bank_name = bank_name;
      paymentRequest.account_number = account_number;
      paymentRequest.bank_notes = bank_notes;
    }

    const paymentResponse = await paymentService.processPayment(selectedProvider, paymentRequest);

    // Create payment record
    const { data: payment, error } = await supabase
      .from("payments")
      // @ts-ignore - Supabase type inference issue with payments table
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
