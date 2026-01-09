import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { paymentService } from "@/lib/payments/payment-service";
import crypto from "crypto";

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

      // Update payment status
      await supabase
        .from("payments")
        .update({
          status: paymentResponse.status,
          metadata: paymentResponse.metadata,
        })
        .eq("provider_transaction_id", transactionRef);
    }

    if (provider === "flutterwave" && body.event === "charge.completed") {
      const transactionId = body.data.id.toString();
      
      // Verify payment
      const paymentResponse = await paymentService.verifyPayment(
        "flutterwave",
        transactionId
      );

      // Update payment status
      await supabase
        .from("payments")
        .update({
          status: paymentResponse.status,
          metadata: paymentResponse.metadata,
        })
        .eq("provider_transaction_id", transactionId);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
