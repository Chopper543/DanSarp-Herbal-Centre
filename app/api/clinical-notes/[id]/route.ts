import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth/rbac";
import { canAccessSection } from "@/lib/auth/role-capabilities";
import { internalError, badRequest } from "@/lib/api/errors";
import { logPhiRead } from "@/lib/audit/phi-read";

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

    // @ts-ignore - supabase type inference
    const { data: note, error } = await supabase
      .from("clinical_notes")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return badRequest("/api/clinical-notes/[id]", error);
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

    // Only admins can delete
    if (!isSystemAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // @ts-ignore - supabase type inference
    const { error } = await supabase.from("clinical_notes").delete().eq("id", id);

    if (error) {
      return badRequest("/api/clinical-notes/[id]", error);
    }

    return NextResponse.json({ message: "Clinical note deleted successfully" }, { status: 200 });
  } catch (error: any) {
    return internalError("/api/clinical-notes/[id]", error);
  }
}
