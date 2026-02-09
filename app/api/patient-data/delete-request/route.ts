import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/audit/log";
import { logger } from "@/lib/monitoring/logger";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const targetUserId = body.user_id || user.id;
    const reason = body.reason || null;

    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);
    if (targetUserId !== user.id && !isUserAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Record deletion request for manual/automated processing
    const { error } = await supabase.from("deletion_requests").insert({
      user_id: targetUserId,
      requested_by: user.id,
      reason,
      status: "pending",
    });

    if (error) {
      logger.error("Failed to queue deletion request", error);
      return NextResponse.json({ error: "Unable to queue deletion request" }, { status: 400 });
    }

    await logAuditEvent({
      userId: user.id,
      action: "request_patient_data_deletion",
      resourceType: "patient_data",
      resourceId: targetUserId,
      metadata: { reason },
      requestInfo: {
        ip:
          request.headers.get("x-forwarded-for")?.split(",")[0] ||
          request.headers.get("x-real-ip") ||
          null,
        userAgent: request.headers.get("user-agent"),
        path: request.nextUrl.pathname,
      },
    });

    return NextResponse.json({ status: "queued" }, { status: 202 });
  } catch (error) {
    logger.error("Patient data deletion request failed", error);
    return NextResponse.json({ error: "Failed to queue deletion request" }, { status: 500 });
  }
}
