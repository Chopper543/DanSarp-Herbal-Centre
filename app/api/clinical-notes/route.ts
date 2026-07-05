import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isDoctor } from "@/lib/auth/rbac";
import { canAccessSection } from "@/lib/auth/role-capabilities";
import { ClinicalNote, VitalSigns } from "@/types";
import { z } from "zod";
import { sanitizeText } from "@/lib/utils/sanitize";
import { logAuditEvent } from "@/lib/audit/log";
import { logger } from "@/lib/monitoring/logger";
import { VitalSignsSchema, findVitalSignWarnings } from "@/lib/clinical/vitals";
import { internalError, badRequest } from "@/lib/api/errors";

const requestInfoFrom = (request: NextRequest) => ({
  ip:
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    null,
  userAgent: request.headers.get("user-agent"),
  path: request.nextUrl.pathname,
});

const ClinicalNoteSchema = z
  .object({
    patient_id: z.string().uuid(),
    appointment_id: z.string().uuid().optional().nullable(),
    note_type: z.string().max(50).default("soap"),
    subjective: z.string().max(8000).optional().nullable(),
    objective: z.string().max(8000).optional().nullable(),
    assessment: z.string().max(8000).optional().nullable(),
    plan: z.string().max(8000).optional().nullable(),
    vital_signs: VitalSignsSchema.optional(),
    diagnosis_codes: z.array(z.string().max(50)).max(50).optional().default([]),
    template_id: z.string().uuid().optional().nullable(),
    is_template: z.boolean().optional().default(false),
    attachments: z.array(z.string().url()).max(20).optional().default([]),
  })
  .strict();

const ClinicalNoteUpdateSchema = ClinicalNoteSchema.partial()
  .extend({
    id: z.string().uuid(),
    amended_reason: z.string().max(2000).optional(),
  })
  .strict();

const ClinicalNoteDeleteSchema = z
  .object({
    deleted_reason: z.string().min(1).max(2000).optional(),
  })
  .partial();

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
    const canAccessClinicalNotes = canAccessSection(userRole, "clinical_notes");

    let query = supabase.from("clinical_notes").select("*", { count: "exact" });

    // If requesting specific note
    if (noteId) {
      const { data: note, error } = await supabase
        .from("clinical_notes")
        .select("*")
        .eq("id", noteId)
        .single();

      if (error) {
        return badRequest("/api/clinical-notes", error);
      }

      // Check permissions
      const typedNote = note as { patient_id: string; doctor_id: string } | null;
      if (
        !canAccessClinicalNotes &&
        typedNote?.patient_id !== user.id &&
        typedNote?.doctor_id !== user.id
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      await logAuditEvent({
        userId: user.id,
        action: "read_clinical_note",
        resourceType: "clinical_note",
        resourceId: noteId,
        metadata: { patient_id: typedNote?.patient_id },
        requestInfo: requestInfoFrom(request),
      });

      return NextResponse.json({ note }, { status: 200 });
    }

    // Filter by patient_id if provided
    if (patientId) {
      if (!canAccessClinicalNotes && patientId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      query = query.eq("patient_id", patientId);
    } else if (!canAccessClinicalNotes) {
      // Regular users can only see their own notes
      query = query.eq("patient_id", user.id);
    }

    // Filter by doctor_id (clinical staff/admin only)
    if (doctorId && canAccessClinicalNotes) {
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

    // Default to live rows only: hide superseded versions and soft-deleted
    // rows. `include_history=true` returns the full amendment chain (for
    // audit/legal review UI).
    const includeHistory = searchParams.get("include_history") === "true";
    if (!includeHistory) {
      query = query.is("superseded_by_id", null).is("deleted_at", null);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to).order("created_at", { ascending: false });

    const { data: notes, error, count } = await query;

    if (error) {
      return badRequest("/api/clinical-notes", error);
    }

    if (patientId && patientId !== user.id) {
      await logAuditEvent({
        userId: user.id,
        action: "list_clinical_notes",
        resourceType: "clinical_note",
        resourceId: patientId,
        metadata: { patient_id: patientId, count: count || 0, page, limit },
        requestInfo: requestInfoFrom(request),
      });
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
    return internalError("/api/clinical-notes", error);
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
    const isSystemAdmin = userRole === "super_admin" || userRole === "admin";

    // Clinical notes can be created by doctors and system admins.
    const canCreate = Boolean(isSystemAdmin || isDoctor(userRole));
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

    const vitalWarnings = findVitalSignWarnings(vital_signs);

    await logAuditEvent({
      userId: user.id,
      action: "create_clinical_note",
      resourceType: "clinical_note",
      resourceId: (note as any)?.id,
      newData: note as Record<string, any>,
      metadata: {
        patient_id,
        appointment_id,
        note_type,
        vital_warnings: vitalWarnings.length ? vitalWarnings : undefined,
      },
      requestInfo: requestInfoFrom(request),
    });

    return NextResponse.json({ note, warnings: vitalWarnings }, { status: 201 });
  } catch (error: any) {
    return internalError("/api/clinical-notes", error);
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
    const isSystemAdmin = userRole === "super_admin" || userRole === "admin";

    const body = await request.json();
    const parsed = ClinicalNoteUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid clinical note update payload", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { id, amended_reason, ...updateData } = parsed.data;

    // Check if note exists and user has permission
    const { data: existingNote, error: fetchError } = await supabase
      .from("clinical_notes")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingNote) {
      return NextResponse.json({ error: "Clinical note not found" }, { status: 404 });
    }

    // Append-only: edits create a NEW row and mark the old one superseded.
    // The original row is preserved verbatim (legal/medical record).
    const typed = existingNote as Record<string, any>;
    if (typed.superseded_by_id) {
      return NextResponse.json(
        { error: "Cannot amend a superseded note. Amend the current version instead." },
        { status: 409 }
      );
    }
    if (typed.deleted_at) {
      return NextResponse.json(
        { error: "Cannot amend a deleted note." },
        { status: 409 }
      );
    }

    const typedExistingNote = existingNote as { doctor_id: string } | null;
    const canEditOwnAsDoctor = isDoctor(userRole) && typedExistingNote?.doctor_id === user.id;
    if (!isSystemAdmin && !canEditOwnAsDoctor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build the amendment row: start from the existing row, layer the
    // requested changes on top. Strip persistence/identity fields that the DB
    // owns or that must not propagate.
    const {
      id: _oldId,
      created_at: _oldCreatedAt,
      updated_at: _oldUpdatedAt,
      version: oldVersion,
      superseded_by_id: _oldSupersededBy,
      amended_from_id: _oldAmendedFrom,
      is_amendment: _oldIsAmendment,
      amended_reason: _oldAmendedReason,
      deleted_at: _oldDeletedAt,
      deleted_by: _oldDeletedBy,
      deleted_reason: _oldDeletedReason,
      ...preservedFields
    } = typed;

    const amendmentRow = {
      ...preservedFields,
      ...updateData,
      subjective: updateData.subjective ? sanitizeText(updateData.subjective) : updateData.subjective ?? preservedFields.subjective ?? null,
      objective: updateData.objective ? sanitizeText(updateData.objective) : updateData.objective ?? preservedFields.objective ?? null,
      assessment: updateData.assessment ? sanitizeText(updateData.assessment) : updateData.assessment ?? preservedFields.assessment ?? null,
      plan: updateData.plan ? sanitizeText(updateData.plan) : updateData.plan ?? preservedFields.plan ?? null,
      version: (typeof oldVersion === "number" ? oldVersion : 1) + 1,
      amended_from_id: id,
      is_amendment: true,
      amended_reason: amended_reason || null,
      created_by: user.id,
      updated_by: user.id,
    };

    const { data: note, error } = await supabase
      .from("clinical_notes")
      .insert(amendmentRow as any)
      .select()
      .single();

    if (error) {
      logger.error("Failed to amend clinical note", error);
      return NextResponse.json({ error: "Unable to amend clinical note" }, { status: 400 });
    }

    // Mark old row superseded. If this fails we end up with two "live" rows in
    // the chain — caller will see both via include_history=true; reconcile
    // manually rather than rolling back the amendment (the amendment is the
    // medically meaningful event and must be preserved).
    const { error: supersedeError } = await supabase
      .from("clinical_notes")
      // @ts-ignore - Supabase type inference issue
      .update({ superseded_by_id: (note as any).id, updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (supersedeError) {
      logger.error("Failed to mark prior clinical note superseded", supersedeError);
    }

    const vitalWarnings = updateData.vital_signs
      ? findVitalSignWarnings(updateData.vital_signs)
      : [];

    await logAuditEvent({
      userId: user.id,
      action: "amend_clinical_note",
      resourceType: "clinical_note",
      resourceId: (note as any)?.id,
      oldData: existingNote as Record<string, any>,
      newData: note as Record<string, any>,
      metadata: {
        patient_id: (typedExistingNote as any)?.patient_id,
        appointment_id: (typedExistingNote as any)?.appointment_id,
        amended_from_id: id,
        amended_reason: amended_reason || null,
        vital_warnings: vitalWarnings.length ? vitalWarnings : undefined,
      },
      requestInfo: requestInfoFrom(request),
    });

    return NextResponse.json({ note, warnings: vitalWarnings }, { status: 200 });
  } catch (error: any) {
    return internalError("/api/clinical-notes", error);
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
    const isSystemAdmin = userRole === "super_admin" || userRole === "admin";

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
    if (!isSystemAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if ((existingNote as any)?.deleted_at) {
      return NextResponse.json({ error: "Note is already deleted" }, { status: 409 });
    }

    const deletedReason = searchParams.get("reason") || null;

    // Soft delete: preserve the row for legal/medical record retention.
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
    return internalError("/api/clinical-notes", error);
  }
}
