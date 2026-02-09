import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isDoctor, isNurse } from "@/lib/auth/rbac";
import { canAccessSection } from "@/lib/auth/role-capabilities";
import { Prescription, HerbFormula } from "@/types";
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
      // @ts-ignore
      const { data: prescription, error } = await supabase
        .from("prescriptions")
        .select("*")
        .eq("id", prescriptionId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
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

    // @ts-ignore
    const { data: prescriptions, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
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
      metadata: { patient_id, appointment_id },
      requestInfo: requestInfoFrom(request),
    });

    return NextResponse.json({ prescription }, { status: 201 });
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
    const typedExistingPrescription = existingPrescription as { doctor_id: string } | null;
    const canUpdateOwnAsDoctor = isDoctor(userRole) && typedExistingPrescription?.doctor_id === user.id;
    if (!isSystemAdmin && !canUpdateAsNurse && !canUpdateOwnAsDoctor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Calculate end_date if duration_days is being updated
    if (updateData.duration_days && updateData.start_date) {
      const start = new Date(updateData.start_date);
      start.setDate(start.getDate() + updateData.duration_days);
      updateData.end_date = start.toISOString().split("T")[0];
    }

    // Update prescription
    const updatePayload = {
      ...updateData,
      instructions: updateData.instructions
        ? sanitizeText(updateData.instructions)
        : updateData.instructions ?? null,
      doctor_notes: updateData.doctor_notes
        ? sanitizeText(updateData.doctor_notes)
        : updateData.doctor_notes ?? null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

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
      metadata: {
        patient_id: (typedExistingPrescription as any)?.patient_id,
        appointment_id: (typedExistingPrescription as any)?.appointment_id,
      },
      requestInfo: requestInfoFrom(request),
    });

    return NextResponse.json({ prescription }, { status: 200 });
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
    // @ts-ignore
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
      metadata: {
        patient_id: (existingPrescription as any)?.patient_id,
        appointment_id: (existingPrescription as any)?.appointment_id,
      },
      requestInfo: requestInfoFrom(request),
    });

    return NextResponse.json({ message: "Prescription cancelled successfully" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
