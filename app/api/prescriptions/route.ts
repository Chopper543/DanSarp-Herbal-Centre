import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin } from "@/lib/auth/rbac";
import { Prescription, HerbFormula } from "@/types";

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
      query = query.eq("id", prescriptionId).single();
      // @ts-ignore
      const { data: prescription, error } = await query;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Check permissions
      if (!isUserAdmin && prescription.patient_id !== user.id && prescription.doctor_id !== user.id) {
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

    // Only doctors and admins can create prescriptions
    if (!isUserAdmin && userRole !== "appointment_manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
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
    } = body;

    // Validation
    if (!patient_id) {
      return NextResponse.json({ error: "Patient ID is required" }, { status: 400 });
    }

    if (!herbs_formulas || !Array.isArray(herbs_formulas) || herbs_formulas.length === 0) {
      return NextResponse.json(
        { error: "At least one herb/formula is required" },
        { status: 400 }
      );
    }

    // Validate herb/formula structure
    for (const herb of herbs_formulas) {
      if (!herb.name || !herb.quantity || !herb.unit || !herb.dosage) {
        return NextResponse.json(
          { error: "Each herb/formula must have name, quantity, unit, and dosage" },
          { status: 400 }
        );
      }
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

    // @ts-ignore
    const { data: prescription, error } = await supabase
      .from("prescriptions")
      .insert(prescriptionData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
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
    const { id, ...updateData } = body;

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

    // Check permissions
    if (!isUserAdmin && existingPrescription.doctor_id !== user.id) {
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

    // @ts-ignore
    const { data: prescription, error } = await supabase
      .from("prescriptions")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
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
      .update({ status: "cancelled", updated_by: user.id })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Prescription cancelled successfully" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
