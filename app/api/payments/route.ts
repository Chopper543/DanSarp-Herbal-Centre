import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { paymentService } from "@/lib/payments/payment-service";
import { PaystackProvider } from "@/lib/payments/providers/paystack";
import { FlutterwaveProvider } from "@/lib/payments/providers/flutterwave";
import { GhanaRailsProvider } from "@/lib/payments/providers/ghana-rails";
import { getUserRole, isUserOnly } from "@/lib/auth/rbac";
import { evaluateBookingPrerequisites } from "@/lib/appointments/prerequisites";
import { logAuditEvent } from "@/lib/audit/log";
import { z } from "zod";
import { logger } from "@/lib/monitoring/logger";

// Register payment providers
paymentService.registerProvider("paystack", new PaystackProvider());
paymentService.registerProvider("flutterwave", new FlutterwaveProvider());
paymentService.registerProvider("custom", new GhanaRailsProvider());

const PaymentRequestSchema = z.object({
  amount: z.coerce.number().positive(),
  currency: z.string().min(1).default("GHS"),
  payment_method: z.string().min(1),
  appointment_id: z.string().uuid().optional(),
  provider: z.enum(["paystack", "flutterwave", "custom"]).optional(),
  appointment_data: z.any().optional(),
  phone_number: z.string().optional(),
  bank_name: z.string().optional(),
  account_number: z.string().optional(),
  bank_notes: z.string().optional(),
  // Card fields should be absent; we keep them to explicitly reject
  card_number: z.string().optional(),
  card_expiry: z.string().optional(),
  card_name: z.string().optional(),
  card_pin: z.string().optional(),
});

/**
 * Ensures user exists in users table before creating payment
 * This handles cases where phone OTP signup creates auth.users but sync trigger hasn't completed
 */
async function ensureUserExists(supabase: any, authUser: any) {
  // Check if user exists in users table
  const { data: existingUser, error: checkError } = await supabase
    .from("users")
    .select("id")
    .eq("id", authUser.id)
    .single();

  if (existingUser) {
    return existingUser; // User exists, return it
  }

  // User doesn't exist, create it from auth.users data
  logger.info("User not found in users table, creating user record", { userId: authUser.id });
  
  const { data: newUser, error: createError } = await supabase
    .from("users")
    // @ts-ignore - Supabase type inference issue with users table
    .insert({
      id: authUser.id,
      email: authUser.email || '',
      full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || null,
      phone: authUser.phone || authUser.user_metadata?.phone || null,
      email_verified: authUser.email_confirmed_at !== null,
    })
    .select()
    .single();

  if (createError) {
    logger.error("Failed to create user in users table", createError);
    // If it's a conflict (user was created between check and insert), try to fetch again
    if (createError.code === '23505') { // Unique violation
      const { data: retryUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", authUser.id)
        .single();
      if (retryUser) {
        return retryUser;
      }
    }
    throw new Error("User record could not be created. Please try again.");
  }

  // Also create profile if it doesn't exist
  await supabase
    .from("profiles")
    // @ts-ignore - Supabase type inference issue with profiles table
    .insert({ id: authUser.id })
    .select()
    .single()
    .then(() => {}) // Ignore errors if profile already exists
    .catch(() => {}); // Profile might already exist, that's okay

  return newUser;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in users table before proceeding
    // This handles cases where phone OTP signup hasn't synced to users table yet
    try {
      await ensureUserExists(supabase, user);
    } catch (error: any) {
      logger.error("Error ensuring user exists", error);
      return NextResponse.json(
        { error: "User account setup incomplete. Please try again in a moment." },
        { status: 500 }
      );
    }

    // Check if user is a regular user (not staff)
    const userRole = await getUserRole();
    if (!isUserOnly(userRole)) {
      return NextResponse.json(
        { error: "Staff members cannot make payments. Please use the admin panel." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = PaymentRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payment request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      amount,
      currency,
      payment_method,
      appointment_id,
      provider,
      appointment_data,
      phone_number,
      bank_name,
      account_number,
      bank_notes,
      card_number,
      card_expiry,
      card_name,
      card_pin,
    } = parsed.data;

    const momoMethods = ["mtn_momo", "vodafone_cash", "airteltigo"];
    if (momoMethods.includes(payment_method) && !phone_number) {
      return NextResponse.json(
        { error: "Phone number is required for mobile money payments" },
        { status: 400 }
      );
    }

    // Reject raw card details to avoid handling PAN/PIN in our backend
    if (card_number || card_expiry || card_name || card_pin) {
      return NextResponse.json(
        {
          error: "Raw card details are not accepted. Please tokenize on the client or use the provider-hosted payment page.",
        },
        { status: 400 }
      );
    }

    // If this payment is for appointment booking (booking fee), enforce prerequisites BEFORE charging.
    if (appointment_data) {
      const prereq = await evaluateBookingPrerequisites();
      if (!prereq.canProceed) {
        return NextResponse.json(
          {
            error:
              "Payment blocked. Please verify your email, add full name + phone, and submit required intake forms.",
            prerequisites: prereq,
          },
          { status: 403 }
        );
      }
    }

    // Determine provider based on payment method
    let selectedProvider = provider || "paystack";
    const customRailsMethods = ["bank_transfer", "ghqr", "mtn_momo", "vodafone_cash", "airteltigo"];
    if (customRailsMethods.includes(payment_method)) {
      selectedProvider = "custom";
    }
    const allowedProviders = ["paystack", "flutterwave", "custom"];
    if (!allowedProviders.includes(selectedProvider)) {
      return NextResponse.json({ error: "Unsupported payment provider" }, { status: 400 });
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
    if (bank_name && account_number) {
      paymentRequest.bank_name = bank_name;
      paymentRequest.account_number = account_number;
      paymentRequest.bank_notes = bank_notes;
    }

    const paymentResponse = await paymentService.processPayment(selectedProvider, paymentRequest);

    // Idempotency: if provider_transaction_id already recorded, return existing payment
    if (paymentResponse.provider_transaction_id) {
      const { data: existingPayment, error: existingPaymentError } = await supabase
        .from("payments")
        .select("*")
        .eq("provider_transaction_id", paymentResponse.provider_transaction_id)
        .eq("user_id", user.id)
        .limit(1)
        .single();
      if (!existingPaymentError && existingPayment) {
        return NextResponse.json(
          {
            payment: existingPayment,
            payment_url: paymentResponse.payment_url,
          },
          { status: 200 }
        );
      }
    }

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
      // Check for foreign key constraint violation
      if (error.message?.includes("foreign key constraint") || error.code === '23503') {
        logger.error("Foreign key constraint violation - user may not exist in users table", {
          userId: user.id,
          error: error.message,
          errorCode: error.code,
        });
        return NextResponse.json(
          { 
            error: "User account not properly set up. Please try logging out and back in, or contact support.",
            details: "The user record is missing from the database. This may happen after phone signup."
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: "Unable to create payment" }, { status: 400 });
    }

    // Audit payment creation (non-blocking)
    await logAuditEvent({
      userId: user.id,
      action: "create_payment",
      resourceType: "payment",
      resourceId: (payment as { id?: string } | null)?.id || null,
      metadata: {
        amount,
        currency: currency || "GHS",
        payment_method,
        provider: selectedProvider,
        appointment_id: appointment_id || null,
      },
    });

    return NextResponse.json({
      payment,
      payment_url: paymentResponse.payment_url,
    }, { status: 201 });
  } catch (error: any) {
    // Check for foreign key constraint violations in catch block
    if (error.message?.includes("foreign key constraint") || error.code === '23503') {
      logger.error("Foreign key constraint error in payment creation", {
        error: error.message,
        errorCode: error.code,
      });
      return NextResponse.json(
        { 
          error: "Database error: User account not properly synchronized. Please try again or contact support.",
          details: "This error typically occurs when the user record hasn't been created in the database yet."
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "An unexpected payment error occurred" }, { status: 500 });
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
