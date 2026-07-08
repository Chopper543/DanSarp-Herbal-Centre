import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isDoctor, isNurse } from "@/lib/auth/rbac";
import { canAccessSection } from "@/lib/auth/role-capabilities";
import { Prescription, HerbFormula } from "@/types";
import { z } from "zod";
import { sanitizeText } from "@/lib/utils/sanitize";
import { logAuditEvent } from "@/lib/audit/log";
import { logger } from "@/lib/monitoring/logger";
import { sendEmail } from "@/lib/email/resend";
import { sendWhatsAppMessage } from "@/lib/whatsapp/twilio";
import { internalError, badRequest } from "@/lib/api/errors";
import {
  checkPatientContraindications,
  validatePrescription,
  InteractionWarning,
} from "@/lib/clinical/prescription-validator";

/**
 * Loads patient-record fields (allergies, current medications) used by the
 * contraindication checker. Returns empty arrays when no record exists — that
 * is *not* a safe-pass, it just means we have no documented contraindications
 * to test against; the herb-pair interaction check still runs.
 */
async function loadPatientSafetyContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  patientId: string
): Promise<{ allergies: string[]; current_medications: string[] }> {
  const { data } = await supabase
    .from("patient_records")
    .select("allergies, current_medications")
    .eq("user_id", patientId)
    .maybeSingle();
  const row = data as { allergies?: string[] | null; current_medications?: string[] | null } | null;
  return {
    allergies: row?.allergies || [],
    current_medications: row?.current_medications || [],
  };
}

function hasBlockingWarning(warnings: InteractionWarning[]): boolean {
  return warnings.some((w) => w.severity === "high");
}

const requestInfoFrom = (request: NextRequest) => ({
  ip:
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    null,
  userAgent: request.headers.get("user-agent"),
  path: request.nextUrl.pathname,
});

const HerbFormulaSchema = z
  .object({
    name: z.string().min(1).max(200),
    quantity: z.union([z.number(), z.string()]),
    unit: z.string().max(50),
    dosage: z.string().max(200),
  })
  .strict();

const PrescriptionSchema = z
  .object({
    patient_id: z.string().uuid(),
    appointment_id: z.string().uuid().optional().nullable(),
    herbs_formulas: z.array(HerbFormulaSchema).min(1).max(25),
    instructions: z.string().max(8000).optional().nullable(),
    duration_days: z.number().int().positive().optional().nullable(),
    refills_original: z.number().int().min(0).max(50).optional().nullable(),
    expiry_date: z.string().date().optional().nullable(),
    start_date: z.string().date().optional().nullable(),
    end_date: z.string().date().optional().nullable(),
    doctor_notes: z.string().max(8000).optional().nullable(),
  })
  .strict();

const PrescriptionUpdateSchema = PrescriptionSchema.partial()
  .extend({
    id: z.string().uuid(),
    status: z.string().max(50).optional(),
  })
  .strict();

async function notifyPatientPrescriptionUpdate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  patientId: string,
  subject: string,
  message: string
) {
  const { data: patient } = await supabase
    .from("users")
    .select("full_name, email, phone")
    .eq("id", patientId)
    .single();
  const typedPatient = patient as { full_name?: string; email?: string; phone?: string | null } | null;
  if (typedPatient?.email) {
    sendEmail({
      to: typedPatient.email,
      subject,
      html: `<p>Hello ${typedPatient.full_name || "Patient"},</p><p>${message}</p><p>Please log in to your dashboard for details.</p>`,
    }).catch(() => {});
  }
  if (typedPatient?.phone) {
    sendWhatsAppMessage(
      typedPatient.phone,
      `DanSarp update: ${message}`
    ).catch(() => {});
  }
}

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
    const prescriptionId = searchParams.get("id");
    const patientId = searchParams.get("patient_id");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const userRole = await getUserRole();
    const canAccessPrescriptions = canAccessSection(userRole, "prescriptions");

    let query = supabase.from("prescriptions").select("*", { count: "exact" });

    // If requesting specific prescription
    if (prescriptionId) {
      // @ts-ignore - supabase type inference
      const { data: prescription, error } = await supabase
        .from("prescriptions")
        .select("*")
        .eq("id", prescriptionId)
        .single();

      if (error) {
        return badRequest("/api/prescriptions", error);
      }

      // Check permissions
      const typedPrescription = prescription as { patient_id: string; doctor_id: string } | null;
      if (
        !canAccessPrescriptions &&
        typedPrescription?.patient_id !== user.id &&
        typedPrescription?.doctor_id !== user.id
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      await logAuditEvent({
        userId: user.id,
        action: "read_prescription",
        resourceType: "prescription",
        resourceId: prescriptionId,
        metadata: { patient_id: typedPrescription?.patient_id },
        requestInfo: requestInfoFrom(request),
      });

      return NextResponse.json({ prescription }, { status: 200 });
    }

    // Filter by patient_id if provided (admin/doctor only)
    if (patientId) {
      if (!canAccessPrescriptions && patientId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      query = query.eq("patient_id", patientId);
    } else if (!canAccessPrescriptions) {
      // Regular users can only see their own prescriptions
      query = query.eq("patient_id", user.id);
    }

    // Filter by status
    if (status) {
      query = query.eq("status", status);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to).order("prescribed_date", { ascending: false });

    // @ts-ignore - supabase type inference
    const { data: prescriptions, error, count } = await query;

    if (error) {
      return badRequest("/api/prescriptions", error);
    }

    if (patientId && patientId !== user.id) {
      await logAuditEvent({
        userId: user.id,
        action: "list_prescriptions",
        resourceType: "prescription",
        resourceId: patientId,
        metadata: { patient_id: patientId, count: count || 0, page, limit },
        requestInfo: requestInfoFrom(request),
      });
    }

    return NextResponse.json(
      {
        prescriptions: prescriptions || [],
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
    return internalError("/api/prescriptions", error);
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

    // Prescriptions can be created by doctors, nurses, and system admins.
    const canCreate = Boolean(
      isSystemAdmin || isDoctor(userRole) || isNurse(userRole)
    );
    if (!canCreate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = PrescriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid prescription payload", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      patient_id,
      appointment_id,
      herbs_formulas,
      instructions,
      duration_days,
      refills_original,
      expiry_date,
      start_date,
      doctor_notes,
    } = parsed.data;

    // Safety validation BEFORE insert — block on high-severity contraindications.
    const baseValidation = validatePrescription({
      patient_id,
      herbs_formulas: herbs_formulas as HerbFormula[],
      start_date: start_date || undefined,
      expiry_date: expiry_date || undefined,
      refills_original: refills_original ?? undefined,
      duration_days: duration_days ?? undefined,
    } as any);
    if (!baseValidation.valid) {
      return NextResponse.json(
        { error: "Prescription validation failed", details: baseValidation.errors },
        { status: 422 }
      );
    }

    const patientContext = await loadPatientSafetyContext(supabase, patient_id);
    const contraindications = checkPatientContraindications(
      herbs_formulas as HerbFormula[],
      patientContext.allergies,
      patientContext.current_medications
    );
    const allWarnings = [...baseValidation.warnings, ...contraindications];
    if (hasBlockingWarning(allWarnings)) {
      return NextResponse.json(
        {
          error: "Prescription blocked by safety check",
          warnings: allWarnings,
        },
        { status: 422 }
      );
    }

    // Calculate end_date if duration_days is provided
    let end_date = null;
    if (duration_days && start_date) {
      const start = new Date(start_date);
      start.setDate(start.getDate() + duration_days);
      end_date = start.toISOString().split("T")[0];
    }

    // Create prescription
    const prescriptionData = {
      patient_id,
      doctor_id: user.id,
      appointment_id: appointment_id || null,
      herbs_formulas: herbs_formulas as HerbFormula[],
      instructions: instructions ? sanitizeText(instructions) : null,
      duration_days: duration_days || null,
      refills_remaining: refills_original || 0,
      refills_original: refills_original || 0,
      expiry_date: expiry_date || null,
      start_date: start_date || null,
      end_date,
      status: "active" as const,
      doctor_notes: doctor_notes ? sanitizeText(doctor_notes) : null,
      created_by: user.id,
    };

    const { data: prescription, error } = await supabase
      .from("prescriptions")
      .insert(prescriptionData as any)
      .select()
      .single();

    if (error) {
      logger.error("Failed to create prescription", error);
      return NextResponse.json({ error: "Unable to create prescription" }, { status: 400 });
    }

    await logAuditEvent({
      userId: user.id,
      action: "create_prescription",
      resourceType: "prescription",
      resourceId: (prescription as any)?.id,
      newData: prescription as Record<string, any>,
      metadata: {
        patient_id,
        appointment_id,
        safety_warnings: allWarnings.length ? allWarnings : undefined,
      },
      requestInfo: requestInfoFrom(request),
    });

    await notifyPatientPrescriptionUpdate(
      supabase,
      patient_id,
      "New prescription issued",
      "A new prescription has been issued for your care plan."
    );

    return NextResponse.json({ prescription, warnings: allWarnings }, { status: 201 });
  } catch (error: any) {
    return internalError("/api/prescriptions", error);
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
    const canUpdateAsNurse = isNurse(userRole);

    const body = await request.json();
    const parsed = PrescriptionUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid prescription update payload", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { id, ...updateData } = parsed.data;

    // Check if prescription exists and user has permission
    const { data: existingPrescription, error: fetchError } = await supabase
      .from("prescriptions")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingPrescription) {
      return NextResponse.json({ error: "Prescription not found" }, { status: 404 });
    }

    // Check permissions
    const typedExistingPrescription = existingPrescription as {
      doctor_id: string;
      patient_id: string;
      status?: string;
    } | null;
    const canUpdateOwnAsDoctor = isDoctor(userRole) && typedExistingPrescription?.doctor_id === user.id;
    if (!isSystemAdmin && !canUpdateAsNurse && !canUpdateOwnAsDoctor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If herbs are being changed, re-run safety checks against the patient's
    // current allergies + medications. Other updates (status, dosage instructions)
    // bypass this since the herb list itself is unchanged.
    let updateWarnings: InteractionWarning[] = [];
    if (updateData.herbs_formulas && typedExistingPrescription?.patient_id) {
      const baseValidation = validatePrescription({
        patient_id: typedExistingPrescription.patient_id,
        herbs_formulas: updateData.herbs_formulas as HerbFormula[],
      } as any);
      if (!baseValidation.valid) {
        return NextResponse.json(
          { error: "Prescription validation failed", details: baseValidation.errors },
          { status: 422 }
        );
      }
      const ctx = await loadPatientSafetyContext(supabase, typedExistingPrescription.patient_id);
      const contraindications = checkPatientContraindications(
        updateData.herbs_formulas as HerbFormula[],
        ctx.allergies,
        ctx.current_medications
      );
      updateWarnings = [...baseValidation.warnings, ...contraindications];
      if (hasBlockingWarning(updateWarnings)) {
        return NextResponse.json(
          { error: "Prescription update blocked by safety check", warnings: updateWarnings },
          { status: 422 }
        );
      }
    }

    // Calculate end_date if duration_days is being updated
    if (updateData.duration_days && updateData.start_date) {
      const start = new Date(updateData.start_date);
      start.setDate(start.getDate() + updateData.duration_days);
      updateData.end_date = start.toISOString().split("T")[0];
    }

    // Allowlist of client-mutable fields. Built explicitly (NOT `...updateData`)
    // so identity/provenance can never be reassigned via a general edit:
    // patient_id + appointment_id (mis-attribution) and refills_original (silent
    // refill inflation) are intentionally omitted — the Zod schema still accepts
    // them (so existing edit forms that resend the unchanged values don't 400),
    // they are simply never written. Only keys the client actually sent are
    // applied (partial update).
    const MUTABLE_PRESCRIPTION_FIELDS = [
      "herbs_formulas",
      "instructions",
      "doctor_notes",
      "duration_days",
      "expiry_date",
      "start_date",
      "end_date",
      "status",
    ] as const;

    const updatePayload: Record<string, any> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };
    for (const key of MUTABLE_PRESCRIPTION_FIELDS) {
      if (key in updateData) updatePayload[key] = (updateData as any)[key];
    }
    if ("instructions" in updatePayload) {
      updatePayload.instructions = updatePayload.instructions ? sanitizeText(updatePayload.instructions) : null;
    }
    if ("doctor_notes" in updatePayload) {
      updatePayload.doctor_notes = updatePayload.doctor_notes ? sanitizeText(updatePayload.doctor_notes) : null;
    }

    const { data: prescription, error } = await supabase
      .from("prescriptions")
      // @ts-ignore - Supabase type inference issue
      .update(updatePayload as any)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update prescription", error);
      return NextResponse.json({ error: "Unable to update prescription" }, { status: 400 });
    }

    await logAuditEvent({
      userId: user.id,
      action: "update_prescription",
      resourceType: "prescription",
      resourceId: (prescription as any)?.id,
      oldData: existingPrescription as Record<string, any>,
      newData: prescription as Record<string, any>,
      metadata: {
        patient_id: (typedExistingPrescription as any)?.patient_id,
        appointment_id: (typedExistingPrescription as any)?.appointment_id,
        safety_warnings: updateWarnings.length ? updateWarnings : undefined,
      },
      requestInfo: requestInfoFrom(request),
    });

    const prescriptionStatus = (updateData.status || (prescription as any)?.status || "updated").toString();
    if (typedExistingPrescription?.patient_id) {
      await notifyPatientPrescriptionUpdate(
        supabase,
        typedExistingPrescription.patient_id,
        "Prescription updated",
        `Your prescription has been updated. Current status: ${sanitizeText(prescriptionStatus)}.`
      );
    }

    return NextResponse.json({ prescription, warnings: updateWarnings }, { status: 200 });
  } catch (error: any) {
    return internalError("/api/prescriptions", error);
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
      return NextResponse.json({ error: "Prescription ID is required" }, { status: 400 });
    }

    // Check if prescription exists and user has permission
    const { data: existingPrescription, error: fetchError } = await supabase
      .from("prescriptions")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingPrescription) {
      return NextResponse.json({ error: "Prescription not found" }, { status: 404 });
    }

    // Only admins can delete prescriptions
    if (!isSystemAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Soft delete by setting status to cancelled
    // @ts-ignore - supabase type inference
    const { error } = await supabase
      .from("prescriptions")
      // @ts-ignore - Supabase type inference issue
      .update({ status: "cancelled", updated_by: user.id, updated_at: new Date().toISOString() } as any)
      .eq("id", id);

    if (error) {
      logger.error("Failed to delete prescription", error);
      return NextResponse.json({ error: "Unable to delete prescription" }, { status: 400 });
    }

    await logAuditEvent({
      userId: user.id,
      action: "delete_prescription",
      resourceType: "prescription",
      resourceId: id,
      oldData: existingPrescription as Record<string, any>,
      metadata: {
        patient_id: (existingPrescription as any)?.patient_id,
        appointment_id: (existingPrescription as any)?.appointment_id,
      },
      requestInfo: requestInfoFrom(request),
    });

    return NextResponse.json({ message: "Prescription cancelled successfully" }, { status: 200 });
  } catch (error: any) {
    return internalError("/api/prescriptions", error);
  }
}
