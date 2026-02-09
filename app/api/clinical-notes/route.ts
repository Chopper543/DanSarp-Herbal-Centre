import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin, isDoctor } from "@/lib/auth/rbac";
import { ClinicalNote, VitalSigns } from "@/types";
import { z } from "zod";
import { sanitizeText } from "@/lib/utils/sanitize";
import { logAuditEvent } from "@/lib/audit/log";
import { logger } from "@/lib/monitoring/logger";

const requestInfoFrom = (request: NextRequest) => ({
  ip:
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    null,
  userAgent: request.headers.get("user-agent"),
  path: request.nextUrl.pathname,
});

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

const ClinicalNoteSchema = z
  .object({
    patient_id: z.string().uuid(),
    appointment_id: z.string().uuid().optional().nullable(),
    note_type: z.string().max(50).default("soap"),
    subjective: z.string().max(8000).optional().nullable(),
    objective: z.string().max(8000).optional().nullable(),
    assessment: z.string().max(8000).optional().nullable(),
    plan: z.string().max(8000).optional().nullable(),
    vital_signs: vitalSignsSchema.optional(),
    diagnosis_codes: z.array(z.string().max(50)).max(50).optional().default([]),
    template_id: z.string().uuid().optional().nullable(),
    is_template: z.boolean().optional().default(false),
    attachments: z.array(z.string().url()).max(20).optional().default([]),
  })
  .strict();

const ClinicalNoteUpdateSchema = ClinicalNoteSchema.partial()
  .extend({
    id: z.string().uuid(),
  })
  .strict();

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get("id");
    const patientId = searchParams.get("patient_id");
    const doctorId = searchParams.get("doctor_id");
    const noteType = searchParams.get("note_type");
    const searchQuery = searchParams.get("search");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);

    let query = supabase.from("clinical_notes").select("*", { count: "exact" });

    // If requesting specific note
    if (noteId) {
      const { data: note, error } = await supabase
        .from("clinical_notes")
        .select("*")
        .eq("id", noteId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Check permissions
      const typedNote = note as { patient_id: string; doctor_id: string } | null;
      if (!isUserAdmin && typedNote?.patient_id !== user.id && typedNote?.doctor_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      return NextResponse.json({ note }, { status: 200 });
    }

    // Filter by patient_id if provided
    if (patientId) {
      if (!isUserAdmin && patientId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      query = query.eq("patient_id", patientId);
    } else if (!isUserAdmin) {
      // Regular users can only see their own notes
      query = query.eq("patient_id", user.id);
    }

    // Filter by doctor_id (admin only)
    if (doctorId && isUserAdmin) {
      query = query.eq("doctor_id", doctorId);
    }

    // Filter by note_type
    if (noteType) {
      query = query.eq("note_type", noteType);
    }

    // Filter by date range
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    // Full-text search
    if (searchQuery) {
      query = query.or(
        `subjective.ilike.%${searchQuery}%,objective.ilike.%${searchQuery}%,assessment.ilike.%${searchQuery}%,plan.ilike.%${searchQuery}%`
      );
    }

    // Exclude templates unless specifically requested
    const includeTemplates = searchParams.get("include_templates") === "true";
    if (!includeTemplates) {
      query = query.eq("is_template", false);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to).order("created_at", { ascending: false });

    const { data: notes, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        notes: notes || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);

    // Clinical notes can be created by doctor + appointment_manager + admin (nurse cannot)
    const canCreate = Boolean(
      isUserAdmin || userRole === "appointment_manager" || isDoctor(userRole)
    );
    if (!canCreate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = ClinicalNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid clinical note payload", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      patient_id,
      appointment_id,
      note_type,
      subjective,
      objective,
      assessment,
      plan,
      vital_signs,
      diagnosis_codes,
      template_id,
      is_template,
      attachments,
    } = parsed.data;

    // Create clinical note
    const noteData = {
      patient_id,
      doctor_id: user.id,
      appointment_id: appointment_id || null,
      note_type: note_type || "soap",
      subjective: subjective ? sanitizeText(subjective) : null,
      objective: objective ? sanitizeText(objective) : null,
      assessment: assessment ? sanitizeText(assessment) : null,
      plan: plan ? sanitizeText(plan) : null,
      vital_signs: (vital_signs || {}) as VitalSigns,
      diagnosis_codes: diagnosis_codes || [],
      template_id: template_id || null,
      is_template: is_template || false,
      attachments: attachments || [],
      created_by: user.id,
    };

    const { data: note, error } = await supabase
      .from("clinical_notes")
      .insert(noteData as any)
      .select()
      .single();

    if (error) {
      logger.error("Failed to create clinical note", error);
      return NextResponse.json({ error: "Unable to create clinical note" }, { status: 400 });
    }

    await logAuditEvent({
      userId: user.id,
      action: "create_clinical_note",
      resourceType: "clinical_note",
      resourceId: (note as any)?.id,
      metadata: {
        patient_id,
        appointment_id,
        note_type,
      },
      requestInfo: requestInfoFrom(request),
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);

    const body = await request.json();
    const parsed = ClinicalNoteUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid clinical note update payload", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { id, ...updateData } = parsed.data;

    // Check if note exists and user has permission
    const { data: existingNote, error: fetchError } = await supabase
      .from("clinical_notes")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingNote) {
      return NextResponse.json({ error: "Clinical note not found" }, { status: 404 });
    }

    // Check permissions
    const typedExistingNote = existingNote as { doctor_id: string } | null;
    if (!isUserAdmin && typedExistingNote?.doctor_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update note
    const updatePayload = {
      ...updateData,
      subjective: updateData.subjective ? sanitizeText(updateData.subjective) : updateData.subjective ?? null,
      objective: updateData.objective ? sanitizeText(updateData.objective) : updateData.objective ?? null,
      assessment: updateData.assessment ? sanitizeText(updateData.assessment) : updateData.assessment ?? null,
      plan: updateData.plan ? sanitizeText(updateData.plan) : updateData.plan ?? null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const { data: note, error } = await supabase
      .from("clinical_notes")
      .update(updatePayload as any)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update clinical note", error);
      return NextResponse.json({ error: "Unable to update clinical note" }, { status: 400 });
    }

    await logAuditEvent({
      userId: user.id,
      action: "update_clinical_note",
      resourceType: "clinical_note",
      resourceId: (note as any)?.id,
      metadata: {
        patient_id: (typedExistingNote as any)?.patient_id,
        appointment_id: (typedExistingNote as any)?.appointment_id,
      },
      requestInfo: requestInfoFrom(request),
    });

    return NextResponse.json({ note }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Clinical note ID is required" }, { status: 400 });
    }

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
    if (!isUserAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Hard delete
    const { error } = await supabase.from("clinical_notes").delete().eq("id", id);

    if (error) {
      logger.error("Failed to delete clinical note", error);
      return NextResponse.json({ error: "Unable to delete clinical note" }, { status: 400 });
    }

    await logAuditEvent({
      userId: user.id,
      action: "delete_clinical_note",
      resourceType: "clinical_note",
      resourceId: id,
      metadata: {
        patient_id: (existingNote as any)?.patient_id,
      },
      requestInfo: requestInfoFrom(request),
    });

    return NextResponse.json({ message: "Clinical note deleted successfully" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
