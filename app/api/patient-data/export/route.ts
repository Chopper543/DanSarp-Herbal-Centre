import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isSystemAdmin } from "@/lib/auth/rbac";
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

    const userRole = await getUserRole();
    const isUserAdmin = isSystemAdmin(userRole);
    if (targetUserId !== user.id && !isUserAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [patientRecord, clinicalNotes, labResults, prescriptions, appointments, intakeResponses, messages] =
      await Promise.all([
      supabase.from("patient_records").select("*").eq("user_id", targetUserId).maybeSingle(),
      supabase.from("clinical_notes").select("*").eq("patient_id", targetUserId).limit(500),
      supabase.from("lab_results").select("*").eq("patient_id", targetUserId).limit(500),
      supabase.from("prescriptions").select("*").eq("patient_id", targetUserId).limit(500),
      supabase.from("appointments").select("*").eq("user_id", targetUserId).limit(500),
      supabase.from("intake_form_responses").select("*").eq("patient_id", targetUserId).limit(500),
      supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${targetUserId},recipient_id.eq.${targetUserId}`)
        .limit(1000),
    ]);

    const exportPayload = {
      user_id: targetUserId,
      generated_at: new Date().toISOString(),
      patient_record: patientRecord.data || null,
      clinical_notes: clinicalNotes.data || [],
      lab_results: labResults.data || [],
      prescriptions: prescriptions.data || [],
      appointments: appointments.data || [],
      intake_form_responses: intakeResponses.data || [],
      messages: messages.data || [],
    };

    await logAuditEvent({
      userId: user.id,
      action: "export_patient_data",
      resourceType: "patient_data",
      resourceId: targetUserId,
      metadata: { counts: {
        clinical_notes: exportPayload.clinical_notes.length,
        lab_results: exportPayload.lab_results.length,
        prescriptions: exportPayload.prescriptions.length,
        appointments: exportPayload.appointments.length,
        intake_form_responses: exportPayload.intake_form_responses.length,
        messages: exportPayload.messages.length,
      }},
      requestInfo: {
        ip:
          request.headers.get("x-forwarded-for")?.split(",")[0] ||
          request.headers.get("x-real-ip") ||
          null,
        userAgent: request.headers.get("user-agent"),
        path: request.nextUrl.pathname,
      },
    });

    return NextResponse.json(exportPayload, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logger.error("Patient data export failed", error);
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 });
  }
}
