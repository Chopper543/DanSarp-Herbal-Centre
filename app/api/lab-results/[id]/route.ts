import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isDoctor, isNurse } from "@/lib/auth/rbac";
import { canAccessSection } from "@/lib/auth/role-capabilities";
import { sanitizeText } from "@/lib/utils/sanitize";
import { z } from "zod";
import { internalError, badRequest } from "@/lib/api/errors";
import { logPhiRead } from "@/lib/audit/phi-read";

const testResultSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .optional();

const LabResultUpdateSchema = z
  .object({
    appointment_id: z.string().uuid().optional().nullable(),
    test_name: z.string().min(1).max(200).optional(),
    test_type: z.string().max(100).optional().nullable(),
    ordered_date: z.string().date().optional().nullable(),
    completed_date: z.string().date().optional().nullable(),
    results: testResultSchema,
    normal_range: z.string().max(1000).optional().nullable(),
    units: z.string().max(100).optional().nullable(),
    file_urls: z.array(z.string().url()).max(20).optional(),
    status: z.string().min(1).max(50).optional(),
    notes: z.string().max(8000).optional().nullable(),
    doctor_notes: z.string().max(8000).optional().nullable(),
  })
  .strict();

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
    const canAccessLabResults = canAccessSection(userRole, "lab_results");

    // @ts-ignore - supabase type inference
    const { data: labResult, error } = await supabase
      .from("lab_results")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return badRequest("/api/lab-results/[id]", error);
    }

    // Check permissions (patients see own; staff can see all)
    const typedLabResult = labResult as { patient_id: string; doctor_id: string } | null;
    if (
      !canAccessLabResults &&
      typedLabResult?.patient_id !== user.id &&
      typedLabResult?.doctor_id !== user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await logPhiRead({
      request,
      userId: user.id,
      resourceType: "lab_result",
      resourceId: id,
      patientId: typedLabResult?.patient_id ?? null,
    });

    return NextResponse.json({ lab_result: labResult }, { status: 200 });
  } catch (error: any) {
    return internalError("/api/lab-results/[id]", error);
  }
}

export async function PUT(
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

    // Check if lab result exists and user has permission
    // @ts-ignore - supabase type inference
    const { data: existingLabResult, error: fetchError } = await supabase
      .from("lab_results")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingLabResult) {
      return NextResponse.json({ error: "Lab result not found" }, { status: 404 });
    }

    // Check permissions (system admin, nurse, or assigned doctor)
    const typedExistingLabResult = existingLabResult as { doctor_id: string } | null;
    const canUpdateAsNurse = isNurse(userRole);
    const canUpdateOwnAsDoctor = isDoctor(userRole) && typedExistingLabResult?.doctor_id === user.id;
    if (!isSystemAdmin && !canUpdateAsNurse && !canUpdateOwnAsDoctor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = LabResultUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid lab result update payload",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Allowlist of client-mutable fields. Built explicitly (NOT `...parsed.data`)
    // so appointment_id can never be reassigned via a general edit — re-targeting
    // the encounter is the same mis-attribution class 908331f closed on the
    // collection route (this /[id] handler was missed). The Zod schema still
    // accepts appointment_id (so edit forms that resend the unchanged value don't
    // 400); it is simply never written. Only keys the client sent are applied.
    const MUTABLE_LAB_FIELDS = [
      "test_name",
      "test_type",
      "ordered_date",
      "completed_date",
      "results",
      "normal_range",
      "units",
      "file_urls",
      "status",
      "notes",
      "doctor_notes",
    ] as const;

    const updatePayload: Record<string, any> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };
    for (const key of MUTABLE_LAB_FIELDS) {
      if (key in parsed.data) updatePayload[key] = (parsed.data as any)[key];
    }
    for (const key of ["normal_range", "units", "notes", "doctor_notes"] as const) {
      if (key in updatePayload) {
        updatePayload[key] = updatePayload[key] ? sanitizeText(updatePayload[key]) : null;
      }
    }

    // @ts-ignore - supabase type inference
    const { data: labResult, error } = await supabase
      .from("lab_results")
      // @ts-ignore - Supabase type inference issue
      .update(updatePayload as any)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return badRequest("/api/lab-results/[id]", error);
    }

    return NextResponse.json({ lab_result: labResult }, { status: 200 });
  } catch (error: any) {
    return internalError("/api/lab-results/[id]", error);
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
    const { error } = await supabase.from("lab_results").delete().eq("id", id);

    if (error) {
      return badRequest("/api/lab-results/[id]", error);
    }

    return NextResponse.json({ message: "Lab result deleted successfully" }, { status: 200 });
  } catch (error: any) {
    return internalError("/api/lab-results/[id]", error);
  }
}
