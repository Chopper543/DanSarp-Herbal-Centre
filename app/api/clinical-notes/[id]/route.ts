import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isDoctor } from "@/lib/auth/rbac";
import { canAccessSection } from "@/lib/auth/role-capabilities";
import { sanitizeText } from "@/lib/utils/sanitize";
import { z } from "zod";

const vitalSignsSchema = z
  .object({
    temperature: z.number().nullable().optional(),
    blood_pressure_systolic: z.number().nullable().optional(),
    blood_pressure_diastolic: z.number().nullable().optional(),
    heart_rate: z.number().nullable().optional(),
    respiratory_rate: z.number().nullable().optional(),
    spo2: z.number().nullable().optional(),
  })
  .strict();

const ClinicalNoteUpdateSchema = z
  .object({
    appointment_id: z.string().uuid().optional().nullable(),
    note_type: z.string().max(50).optional(),
    subjective: z.string().max(8000).optional().nullable(),
    objective: z.string().max(8000).optional().nullable(),
    assessment: z.string().max(8000).optional().nullable(),
    plan: z.string().max(8000).optional().nullable(),
    vital_signs: vitalSignsSchema.optional(),
    diagnosis_codes: z.array(z.string().max(50)).max(50).optional(),
    template_id: z.string().uuid().optional().nullable(),
    is_template: z.boolean().optional(),
    attachments: z.array(z.string().url()).max(20).optional(),
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
    const canAccessClinicalNotes = canAccessSection(userRole, "clinical_notes");

    // @ts-ignore
    const { data: note, error } = await supabase
      .from("clinical_notes")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
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

    return NextResponse.json({ note }, { status: 200 });
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

    // Check if note exists and user has permission
    // @ts-ignore
    const { data: existingNote, error: fetchError } = await supabase
      .from("clinical_notes")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingNote) {
      return NextResponse.json({ error: "Clinical note not found" }, { status: 404 });
    }

    // Check permissions (system admin or assigned doctor can update)
    const typedExistingNote = existingNote as { doctor_id: string } | null;
    const canEditOwnAsDoctor = isDoctor(userRole) && typedExistingNote?.doctor_id === user.id;
    if (!isSystemAdmin && !canEditOwnAsDoctor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = ClinicalNoteUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid clinical note update payload",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const updatePayload = {
      ...parsed.data,
      subjective: parsed.data.subjective
        ? sanitizeText(parsed.data.subjective)
        : parsed.data.subjective ?? null,
      objective: parsed.data.objective
        ? sanitizeText(parsed.data.objective)
        : parsed.data.objective ?? null,
      assessment: parsed.data.assessment
        ? sanitizeText(parsed.data.assessment)
        : parsed.data.assessment ?? null,
      plan: parsed.data.plan
        ? sanitizeText(parsed.data.plan)
        : parsed.data.plan ?? null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    // @ts-ignore
    const { data: note, error } = await supabase
      .from("clinical_notes")
      // @ts-ignore - Supabase type inference issue
      .update(updatePayload as any)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ note }, { status: 200 });
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
    const { error } = await supabase.from("clinical_notes").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Clinical note deleted successfully" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
