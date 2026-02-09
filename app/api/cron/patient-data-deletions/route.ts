import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/monitoring/logger";

type DeletionRequest = {
  id: string;
  user_id: string;
  requested_by: string | null;
  reason: string | null;
};

async function writeDeletionAuditLog(
  supabase: any,
  requestedBy: string | null,
  targetUserId: string,
  action: string,
  metadata: Record<string, any> = {}
) {
  await supabase.from("audit_logs").insert({
    user_id: requestedBy,
    action,
    resource_type: "patient_data",
    resource_id: targetUserId,
    metadata,
  });
}

async function processDeletionRequest(supabase: any, request: DeletionRequest) {
  const targetUserId = request.user_id;
  const startedAt = new Date().toISOString();

  await supabase
    .from("deletion_requests")
    .update({
      status: "processing",
      updated_at: startedAt,
    })
    .eq("id", request.id);

  try {
    await Promise.all([
      supabase.from("messages").delete().eq("sender_id", targetUserId),
      supabase.from("messages").delete().eq("recipient_id", targetUserId),
      supabase.from("appointment_waitlist").delete().eq("patient_id", targetUserId),
      supabase.from("health_metrics").delete().eq("patient_id", targetUserId),
      supabase.from("intake_form_responses").delete().eq("patient_id", targetUserId),
      supabase.from("clinical_notes").delete().eq("patient_id", targetUserId),
      supabase.from("lab_results").delete().eq("patient_id", targetUserId),
      supabase.from("prescriptions").delete().eq("patient_id", targetUserId),
      supabase.from("appointments").delete().eq("user_id", targetUserId),
      supabase.from("payments").delete().eq("user_id", targetUserId),
      supabase.from("patient_records").delete().eq("user_id", targetUserId),
      supabase.from("reviews").delete().eq("user_id", targetUserId),
      supabase.from("profiles").delete().eq("id", targetUserId),
    ]);

    const deletedEmail = `deleted+${targetUserId}@deleted.local`;
    await supabase
      .from("users")
      .update({
        email: deletedEmail,
        full_name: "Deleted User",
        phone: null,
        is_active: false,
        email_verified: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);

    await supabase
      .from("deletion_requests")
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    await writeDeletionAuditLog(supabase, request.requested_by, targetUserId, "process_patient_data_deletion", {
      deletion_request_id: request.id,
      reason: request.reason,
    });

    return { success: true as const };
  } catch (error: any) {
    await supabase
      .from("deletion_requests")
      .update({
        status: "failed",
        error_message: error?.message || "Unknown deletion error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    await writeDeletionAuditLog(
      supabase,
      request.requested_by,
      targetUserId,
      "process_patient_data_deletion_failed",
      {
        deletion_request_id: request.id,
        error: error?.message || "Unknown deletion error",
      }
    );

    return { success: false as const, error: error?.message || "Unknown deletion error" };
  }
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    // @ts-ignore - Supabase type inference issue
    const { data: pendingRequests, error } = await supabase
      .from("deletion_requests")
      .select("id, user_id, requested_by, reason")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(25);

    if (error) {
      logger.error("Failed to fetch deletion requests", error);
      return NextResponse.json({ error: "Failed to fetch deletion requests" }, { status: 400 });
    }

    if (!pendingRequests || pendingRequests.length === 0) {
      return NextResponse.json({ success: true, processed: 0, failed: 0 });
    }

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const deletionRequest of pendingRequests as DeletionRequest[]) {
      const result = await processDeletionRequest(supabase, deletionRequest);
      if (result.success) {
        processed++;
      } else {
        failed++;
        errors.push(`Request ${deletionRequest.id}: ${result.error}`);
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      failed,
      errors,
    });
  } catch (error: any) {
    logger.error("Patient data deletion cron failed", error);
    return NextResponse.json({ error: "Deletion processing failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
