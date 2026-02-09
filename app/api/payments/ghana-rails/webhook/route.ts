import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const WEBHOOK_SECRET = process.env.GHANA_RAILS_WEBHOOK_SECRET;
const supabaseAdmin = (() => {
  try {
    return createServiceClient();
  } catch {
    return null;
  }
})();

type GhanaRailsWebhookPayload = {
  provider_transaction_id: string;
  status: "pending" | "completed" | "failed" | "processing";
  metadata?: Record<string, any>;
};

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

    const nextStatus =
      status === "completed"
        ? "completed"
        : status === "failed"
          ? "failed"
          : "pending";

    // Merge metadata and persist provider status for later verification
    const mergedMetadata = {
      ...(paymentRecord.metadata as Record<string, any> | null | undefined),
      provider_status: status,
      provider_webhook_received_at: new Date().toISOString(),
      provider_webhook_payload: metadata || {},
    };

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

    return NextResponse.json({ message: "Payment updated", status: nextStatus });
  } catch (error: any) {
    console.error("Ghana rails webhook error:", error);
    return NextResponse.json(
      { error: error?.message || "Webhook processing failed" },
      { status: 500 }
    );
  }
}
