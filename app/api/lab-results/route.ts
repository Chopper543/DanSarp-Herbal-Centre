import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin, isDoctor, isNurse } from "@/lib/auth/rbac";
import { LabResult, TestResult } from "@/types";
import { sendEmail } from "@/lib/email/resend";
import { z } from "zod";

const LabResultCreateSchema = z.object({
  patient_id: z.string().uuid(),
  appointment_id: z.string().uuid().nullable().optional(),
  test_name: z.string(),
  test_type: z.string().optional().nullable(),
  ordered_date: z.string().optional().nullable(),
  completed_date: z.string().optional().nullable(),
  results: z.record(z.any()).optional().nullable(),
  normal_range: z.string().optional().nullable(),
  units: z.string().optional().nullable(),
  file_urls: z.array(z.string()).optional().nullable(),
  status: z
    .enum(["pending", "in_progress", "completed", "cancelled"])
    .optional()
    .nullable(),
  notes: z.string().optional().nullable(),
  doctor_notes: z.string().optional().nullable(),
});

const LabResultUpdateSchema = LabResultCreateSchema.extend({
  id: z.string().uuid(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
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
    const labResultId = searchParams.get("id");
    const patientId = searchParams.get("patient_id");
    const doctorId = searchParams.get("doctor_id");
    const status = searchParams.get("status");
    const testType = searchParams.get("test_type");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);

    let query = supabase.from("lab_results").select("*", { count: "exact" });

    // If requesting specific lab result
    if (labResultId) {
      // @ts-ignore
      const { data: labResult, error } = await supabase
        .from("lab_results")
        .select("*")
        .eq("id", labResultId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Check permissions
      const typedLabResult = labResult as { patient_id: string; doctor_id: string } | null;
      if (!isUserAdmin && typedLabResult?.patient_id !== user.id && typedLabResult?.doctor_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      return NextResponse.json({ lab_result: labResult }, { status: 200 });
    }

    // Filter by patient_id if provided
    if (patientId) {
      if (!isUserAdmin && patientId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      query = query.eq("patient_id", patientId);
    } else if (!isUserAdmin) {
      // Regular users can only see their own lab results
      query = query.eq("patient_id", user.id);
    }

    // Filter by doctor_id (admin only)
    if (doctorId && isUserAdmin) {
      query = query.eq("doctor_id", doctorId);
    }

    // Filter by status
    if (status) {
      query = query.eq("status", status);
    }

    // Filter by test_type
    if (testType) {
      query = query.eq("test_type", testType);
    }

    // Filter by date range
    if (startDate) {
      query = query.gte("ordered_date", startDate);
    }
    if (endDate) {
      query = query.lte("ordered_date", endDate);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to).order("ordered_date", { ascending: false });

    // @ts-ignore
    const { data: labResults, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        lab_results: labResults || [],
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

    // Clinical staff can create lab results (doctor + nurse + appointment_manager + admin)
    const canCreate = Boolean(
      isUserAdmin ||
        userRole === "appointment_manager" ||
        isDoctor(userRole) ||
        isNurse(userRole)
    );
    if (!canCreate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = LabResultCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      patient_id,
      appointment_id,
      test_name,
      test_type,
      ordered_date,
      completed_date,
      results,
      normal_range,
      units,
      file_urls,
      status,
      notes,
      doctor_notes,
    } = parsed.data;

    // Create lab result
    const labResultData = {
      patient_id,
      doctor_id: user.id,
      appointment_id: appointment_id || null,
      test_name,
      test_type: test_type || null,
      ordered_date: ordered_date || new Date().toISOString().split("T")[0],
      completed_date: completed_date || null,
      results: (results || {}) as TestResult,
      normal_range: normal_range || null,
      units: units || null,
      file_urls: file_urls || [],
      status: status || "pending",
      notes: notes || null,
      doctor_notes: doctor_notes || null,
      created_by: user.id,
    };

    const { data: labResult, error } = await supabase
      .from("lab_results")
      .insert(labResultData as any)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Notify patient when results are completed
    if ((labResult as any)?.status === "completed") {
      const { data: patient } = await supabase
        .from("users")
        .select("email, full_name")
        .eq("id", patient_id)
        .single();

      const patientEmail = (patient as { email?: string } | null)?.email;
      if (patientEmail) {
        sendEmail({
          to: patientEmail,
          subject: "Lab results ready",
          html: `<p>Hello ${(patient as any)?.full_name || "Patient"},</p><p>Your lab results are ready. Please log in to view the details.</p>`,
        }).catch(() => {});
      }
    }

    return NextResponse.json({ labResult }, { status: 201 });
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
    const parsed = LabResultUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { id, ...updateData } = parsed.data;

    // Check if lab result exists and user has permission
    const { data: existingLabResult, error: fetchError } = await supabase
      .from("lab_results")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingLabResult) {
      return NextResponse.json({ error: "Lab result not found" }, { status: 404 });
    }

    // Check permissions
    const typedExistingLabResult = existingLabResult as { doctor_id: string } | null;
    if (!isUserAdmin && typedExistingLabResult?.doctor_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update lab result
    const updatePayload = {
      ...updateData,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const { data: labResult, error } = await supabase
      .from("lab_results")
      .update(updatePayload as any)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Notify patient when results move to completed
    const finalStatus = (labResult as any)?.status;
    if (finalStatus === "completed") {
      const { data: patient } = await supabase
        .from("users")
        .select("email, full_name")
        .eq("id", existingLabResult.patient_id)
        .single();

      const patientEmail = (patient as { email?: string } | null)?.email;
      if (patientEmail) {
        sendEmail({
          to: patientEmail,
          subject: "Lab results ready",
          html: `<p>Hello ${(patient as any)?.full_name || "Patient"},</p><p>Your lab results are now available. Please log in to review them.</p>`,
        }).catch(() => {});
      }
    }

    return NextResponse.json({ labResult }, { status: 200 });
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
      return NextResponse.json({ error: "Lab result ID is required" }, { status: 400 });
    }

    // Check if lab result exists
    // @ts-ignore
    const { data: existingLabResult, error: fetchError } = await supabase
      .from("lab_results")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingLabResult) {
      return NextResponse.json({ error: "Lab result not found" }, { status: 404 });
    }

    // Only admins can delete lab results
    if (!isUserAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Hard delete (as per migration policy)
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
