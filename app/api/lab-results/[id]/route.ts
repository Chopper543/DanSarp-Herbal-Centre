import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isDoctor, isNurse } from "@/lib/auth/rbac";
import { canAccessSection } from "@/lib/auth/role-capabilities";
import { sanitizeText } from "@/lib/utils/sanitize";
import { z } from "zod";

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

    // @ts-ignore
    const { data: labResult, error } = await supabase
      .from("lab_results")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
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

    return NextResponse.json({ lab_result: labResult }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
    // @ts-ignore
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

    const updatePayload = {
      ...parsed.data,
      normal_range: parsed.data.normal_range
        ? sanitizeText(parsed.data.normal_range)
        : parsed.data.normal_range ?? null,
      units: parsed.data.units ? sanitizeText(parsed.data.units) : parsed.data.units ?? null,
      notes: parsed.data.notes ? sanitizeText(parsed.data.notes) : parsed.data.notes ?? null,
      doctor_notes: parsed.data.doctor_notes
        ? sanitizeText(parsed.data.doctor_notes)
        : parsed.data.doctor_notes ?? null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    // @ts-ignore
    const { data: labResult, error } = await supabase
      .from("lab_results")
      // @ts-ignore - Supabase type inference issue
      .update(updatePayload as any)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ lab_result: labResult }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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

    // @ts-ignore
    const { error } = await supabase.from("lab_results").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Lab result deleted successfully" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
