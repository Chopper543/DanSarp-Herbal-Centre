import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin, isDoctor } from "@/lib/auth/rbac";
import { Prescription, HerbFormula } from "@/types";
import { sendEmail } from "@/lib/email/resend";
import { z } from "zod";

const HerbFormulaSchema = z.object({
  name: z.string(),
  quantity: z.union([z.string(), z.number()]),
  unit: z.string(),
  dosage: z.string(),
});

const PrescriptionCreateSchema = z.object({
  patient_id: z.string().uuid(),
  appointment_id: z.string().uuid().nullable().optional(),
  herbs_formulas: z.array(HerbFormulaSchema).min(1),
  instructions: z.string().optional().nullable(),
  duration_days: z.number().int().positive().optional().nullable(),
  refills_original: z.number().int().nonnegative().optional().nullable(),
  expiry_date: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  doctor_notes: z.string().optional().nullable(),
});

const PrescriptionUpdateSchema = z.object({
  id: z.string().uuid(),
  herbs_formulas: z.array(HerbFormulaSchema).optional(),
  instructions: z.string().optional().nullable(),
  duration_days: z.number().int().positive().optional().nullable(),
  refills_original: z.number().int().nonnegative().optional().nullable(),
  refills_remaining: z.number().int().nonnegative().optional().nullable(),
  expiry_date: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  doctor_notes: z.string().optional().nullable(),
  status: z
    .enum(["active", "completed", "cancelled", "expired"])
    .optional(),
});

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
    const isUserAdmin = userRole && isAdmin(userRole);

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
      if (!isUserAdmin && typedPrescription?.patient_id !== user.id && typedPrescription?.doctor_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      return NextResponse.json({ prescription }, { status: 200 });
    }

    // Filter by patient_id if provided (admin/doctor only)
    if (patientId) {
      if (!isUserAdmin && patientId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      query = query.eq("patient_id", patientId);
    } else if (!isUserAdmin) {
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
    const isUserAdmin = userRole && isAdmin(userRole);

    // Prescriptions can be created by doctor + appointment_manager + admin (nurse cannot)
    const canCreate = Boolean(
      isUserAdmin || userRole === "appointment_manager" || isDoctor(userRole)
    );
    if (!canCreate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = PrescriptionCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
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
      instructions: instructions || null,
      duration_days: duration_days || null,
      refills_remaining: refills_original || 0,
      refills_original: refills_original || 0,
      expiry_date: expiry_date || null,
      start_date: start_date || null,
      end_date,
      status: "active" as const,
      doctor_notes: doctor_notes || null,
      created_by: user.id,
    };

    const { data: prescription, error } = await supabase
      .from("prescriptions")
      .insert(prescriptionData as any)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Notify patient (fire-and-forget)
    const { data: patient } = await supabase
      .from("users")
      .select("email, full_name")
      .eq("id", patient_id)
      .single();

    const patientEmail = (patient as { email?: string } | null)?.email;
    if (patientEmail) {
      sendEmail({
        to: patientEmail,
        subject: "New prescription available",
        html: `<p>Hello ${(patient as any)?.full_name || "Patient"},</p><p>A new prescription has been issued for you. Please log in to view details.</p>`,
      }).catch(() => {});
    }

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
    const isUserAdmin = userRole && isAdmin(userRole);

    const body = await request.json();
    const parsed = PrescriptionUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
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
    if (!isUserAdmin && typedExistingPrescription?.doctor_id !== user.id) {
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
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const { data: prescription, error } = await supabase
      .from("prescriptions")
      .update(updatePayload as any)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Notify patient about update (fire-and-forget)
    const { data: patient } = await supabase
      .from("users")
      .select("email, full_name")
      .eq("id", existingPrescription.patient_id)
      .single();

    const patientEmail = (patient as { email?: string } | null)?.email;
    if (patientEmail) {
      sendEmail({
        to: patientEmail,
        subject: "Prescription updated",
        html: `<p>Hello ${(patient as any)?.full_name || "Patient"},</p><p>Your prescription has been updated. Please log in to review the changes.</p>`,
      }).catch(() => {});
    }

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
    const isUserAdmin = userRole && isAdmin(userRole);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Prescription ID is required" }, { status: 400 });
    }

    // Check if prescription exists and user has permission
    // @ts-ignore
    const { data: existingPrescription, error: fetchError } = await supabase
      .from("prescriptions")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingPrescription) {
      return NextResponse.json({ error: "Prescription not found" }, { status: 404 });
    }

    // Only admins can delete prescriptions
    if (!isUserAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Soft delete by setting status to cancelled
    // @ts-ignore
    const { error } = await supabase
      .from("prescriptions")
      // @ts-ignore - Supabase type inference issue
      .update({ status: "cancelled", updated_by: user.id } as any)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Prescription cancelled successfully" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
