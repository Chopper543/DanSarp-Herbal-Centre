import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin, isDoctor, isNurse } from "@/lib/auth/rbac";
import { LabResult, TestResult } from "@/types";
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

const testResultSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .optional();

const LabResultSchema = z
  .object({
    patient_id: z.string().uuid(),
    appointment_id: z.string().uuid().optional().nullable(),
    test_name: z.string().min(1).max(200),
    test_type: z.string().optional().nullable(),
    ordered_date: z.string().date().optional().nullable(),
    completed_date: z.string().date().optional().nullable(),
    results: testResultSchema.default({}),
    normal_range: z.string().optional().nullable(),
    units: z.string().optional().nullable(),
    file_urls: z.array(z.string().url()).max(20).optional().default([]),
    status: z.string().min(1).max(50).default("pending"),
    notes: z.string().max(8000).optional().nullable(),
    doctor_notes: z.string().max(8000).optional().nullable(),
  })
  .strict();

const LabResultUpdateSchema = LabResultSchema.partial()
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
    const parsed = LabResultSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid lab result payload", details: parsed.error.flatten().fieldErrors },
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
      normal_range: normal_range ? sanitizeText(normal_range) : null,
      units: units ? sanitizeText(units) : null,
      file_urls: file_urls || [],
      status: status || "pending",
      notes: notes ? sanitizeText(notes) : null,
      doctor_notes: doctor_notes ? sanitizeText(doctor_notes) : null,
      created_by: user.id,
    };

    const { data: labResult, error } = await supabase
      .from("lab_results")
      .insert(labResultData as any)
      .select()
      .single();

    if (error) {
      logger.error("Failed to create lab result", error);
      return NextResponse.json({ error: "Unable to create lab result" }, { status: 400 });
    }

    await logAuditEvent({
      userId: user.id,
      action: "create_lab_result",
      resourceType: "lab_result",
      resourceId: (labResult as any)?.id,
      metadata: {
        patient_id,
        appointment_id,
        test_type,
      },
      requestInfo: requestInfoFrom(request),
    });

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
        { error: "Invalid lab result update payload", details: parsed.error.flatten().fieldErrors },
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
      normal_range: updateData.normal_range
        ? sanitizeText(updateData.normal_range)
        : updateData.normal_range ?? null,
      units: updateData.units ? sanitizeText(updateData.units) : updateData.units ?? null,
      notes: updateData.notes ? sanitizeText(updateData.notes) : updateData.notes ?? null,
      doctor_notes: updateData.doctor_notes
        ? sanitizeText(updateData.doctor_notes)
        : updateData.doctor_notes ?? null,
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
      logger.error("Failed to update lab result", error);
      return NextResponse.json({ error: "Unable to update lab result" }, { status: 400 });
    }

    await logAuditEvent({
      userId: user.id,
      action: "update_lab_result",
      resourceType: "lab_result",
      resourceId: (labResult as any)?.id,
      metadata: {
        patient_id: (typedExistingLabResult as any)?.patient_id,
        appointment_id: (typedExistingLabResult as any)?.appointment_id,
      },
      requestInfo: requestInfoFrom(request),
    });

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
    const { error } = await supabase.from("lab_results").delete().eq("id", id);

    if (error) {
      logger.error("Failed to delete lab result", error);
      return NextResponse.json({ error: "Unable to delete lab result" }, { status: 400 });
    }

    await logAuditEvent({
      userId: user.id,
      action: "delete_lab_result",
      resourceType: "lab_result",
      resourceId: id,
      metadata: {
        patient_id: (existingLabResult as any)?.patient_id,
      },
      requestInfo: requestInfoFrom(request),
    });

    return NextResponse.json({ message: "Lab result deleted successfully" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
