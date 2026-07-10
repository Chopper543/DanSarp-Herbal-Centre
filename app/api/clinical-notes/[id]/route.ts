import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth/rbac";
import { canAccessSection } from "@/lib/auth/role-capabilities";
import { internalError } from "@/lib/api/errors";
import { logPhiRead } from "@/lib/audit/phi-read";
import { logAuditEvent } from "@/lib/audit/log";
import { sanitizeText } from "@/lib/utils/sanitize";
import { logger } from "@/lib/monitoring/logger";

const requestInfoFrom = (request: NextRequest) => ({
  ip:
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    null,
  userAgent: request.headers.get("user-agent"),
  path: request.nextUrl.pathname,
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getUserRole();
    const canAccessClinicalNotes = canAccessSection(userRole, "clinical_notes");

    // Default to the live row: hide soft-deleted notes. `include_history=true`
    // still returns a soft-deleted note for audit/legal review, matching the
    // list route convention (clinical-notes/route.ts:159-161).
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get("include_history") === "true";

    let query = supabase.from("clinical_notes").select("*").eq("id", id);
    if (!includeHistory) {
      query = query.is("deleted_at", null);
    }

    // @ts-ignore - supabase type inference
    const { data: note, error } = await query.single();

    if (error || !note) {
      // Missing, or soft-deleted and not requesting history — hidden by default.
      return NextResponse.json({ error: "Clinical note not found" }, { status: 404 });
    }

    // Check permissions (patients see own; staff can see all)
    const typedNote = note as { patient_id: string; doctor_id: string } | null;
    if (
      !canAccessClinicalNotes &&
      typedNote?.patient_id !== user.id &&
      typedNote?.doctor_id !== user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await logPhiRead({
      request,
      userId: user.id,
      resourceType: "clinical_note",
      resourceId: id,
      patientId: typedNote?.patient_id ?? null,
    });

    return NextResponse.json({ note }, { status: 200 });
  } catch (error: any) {
    return internalError("/api/clinical-notes/[id]", error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getUserRole();
    const isSystemAdmin = userRole === "super_admin" || userRole === "admin";

    // Check if note exists
    const { data: existingNote, error: fetchError } = await supabase
      .from("clinical_notes")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingNote) {
      return NextResponse.json({ error: "Clinical note not found" }, { status: 404 });
    }

    // Only admins can delete clinical notes
    if (!isSystemAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if ((existingNote as any)?.deleted_at) {
      return NextResponse.json({ error: "Note is already deleted" }, { status: 409 });
    }

    const deletedReason = new URL(request.url).searchParams.get("reason") || null;

    // Soft delete: preserve the row for legal/medical record retention. The row
    // is never physically removed by the application path (final_schema.sql:1663).
    const { data: deleted, error } = await supabase
      .from("clinical_notes")
      // @ts-ignore - Supabase type inference issue
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        deleted_reason: deletedReason ? sanitizeText(deletedReason) : null,
      } as any)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Failed to soft-delete clinical note", error);
      return NextResponse.json({ error: "Unable to delete clinical note" }, { status: 400 });
    }

    await logAuditEvent({
      userId: user.id,
      action: "delete_clinical_note",
      resourceType: "clinical_note",
      resourceId: id,
      oldData: existingNote as Record<string, any>,
      newData: deleted as Record<string, any>,
      metadata: {
        patient_id: (existingNote as any)?.patient_id,
        soft_delete: true,
        deleted_reason: deletedReason,
      },
      requestInfo: requestInfoFrom(request),
    });

    return NextResponse.json({ message: "Clinical note deleted successfully" }, { status: 200 });
  } catch (error: any) {
    return internalError("/api/clinical-notes/[id]", error);
  }
}
