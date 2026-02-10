import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth/rbac";
import { canAccessSection } from "@/lib/auth/role-capabilities";
import { logAuditEvent } from "@/lib/audit/log";
import { logger } from "@/lib/monitoring/logger";
import {
  PatientRecordPayloadSchema,
  normalizePatientRecordPayload,
  normalizePatientRecordUpdatePayload,
} from "@/lib/patient-records/payload";

const requestInfoFrom = (request: NextRequest) => ({
  ip:
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    null,
  userAgent: request.headers.get("user-agent"),
  path: request.nextUrl.pathname,
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
    const userId = searchParams.get("user_id");

    // If user_id is provided, get that specific record
    if (userId) {
      const userRole = await getUserRole();
      const canAccessPatientRecords = canAccessSection(userRole, "patient_records");
      
      // Only allow if staff has section access or requesting own record.
      if (!canAccessPatientRecords && userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { data: record, error } = await supabase
        .from("patient_records")
        .select(`
          *,
          users:user_id (
            id,
            email,
            full_name,
            phone
          )
        `)
        .eq("user_id", userId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ record }, { status: 200 });
    }

    // Get user's role
    const userRole = await getUserRole();
    const canAccessPatientRecords = canAccessSection(userRole, "patient_records");

    if (canAccessPatientRecords) {
      // Staff with patient_records section access can get all records.
      // @ts-ignore - Supabase type inference issue
      const { data: records, error } = await supabase
        .from("patient_records")
        .select(`
          *,
          users:user_id (
            id,
            email,
            full_name,
            phone
          )
        `)
        .order("last_visit_date", { ascending: false, nullsFirst: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ records }, { status: 200 });
    } else {
      // Regular users can only get their own record
      // @ts-ignore - Supabase type inference issue
      const { data: record, error } = await supabase
        .from("patient_records")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ record: record || null }, { status: 200 });
    }
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

    const body = await request.json();
    const parsed = PatientRecordPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid patient record payload", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { user_id, ...recordData } = parsed.data;

    // Check if user is admin
    const userRole = await getUserRole();
    const canAccessPatientRecords = canAccessSection(userRole, "patient_records");

    // Only patient-records staff can create records for other users.
    const targetUserId = user_id || user.id;
    if (targetUserId !== user.id && !canAccessPatientRecords) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (canAccessPatientRecords && !user_id) {
      return NextResponse.json(
        { error: "user_id is required when creating a patient record as staff" },
        { status: 400 }
      );
    }

    const normalizedRecordData = normalizePatientRecordPayload(recordData);

    // Check if record already exists
    const { data: existing } = await supabase
      .from("patient_records")
      .select("id")
      .eq("user_id", targetUserId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Patient record already exists. Use PUT to update." },
        { status: 400 }
      );
    }

    // Insert new record
    const { data: record, error } = await supabase
      .from("patient_records")
      // @ts-ignore - Supabase type inference issue
      .insert({
        user_id: targetUserId,
        created_by: user.id,
        ...normalizedRecordData,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create patient record", error);
      return NextResponse.json({ error: "Unable to create patient record" }, { status: 400 });
    }

    await logAuditEvent({
      userId: user.id,
      action: "create_patient_record",
      resourceType: "patient_record",
      resourceId: (record as any)?.id,
      metadata: {
        target_user_id: targetUserId,
      },
      requestInfo: requestInfoFrom(request),
    });

    return NextResponse.json({ record }, { status: 201 });
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

    const body = await request.json();
    const parsed = PatientRecordPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid patient record update payload", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { user_id, ...updateData } = parsed.data;

    const userRole = await getUserRole();
    const canAccessPatientRecords = canAccessSection(userRole, "patient_records");

    const targetUserId = user_id || user.id;

    // Check permissions
    if (targetUserId !== user.id && !canAccessPatientRecords) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If user is not an admin, prevent updating medical fields
    if (!canAccessPatientRecords && targetUserId === user.id) {
      const medicalFields = [
        'primary_condition',
        'condition_started_date',
        'medical_history',
        'doctor_notes',
        'allergies',
        'current_medications',
        'blood_type',
        'insurance_provider',
        'insurance_number',
      ];
      
      // Check if user is trying to update medical fields
      const hasMedicalFields = medicalFields.some(field => field in updateData);
      if (hasMedicalFields) {
        return NextResponse.json(
          { error: "Patients cannot update medical fields. Please contact an administrator." },
          { status: 403 }
        );
      }
    }

    const normalizedUpdateData = normalizePatientRecordUpdatePayload(updateData);

    // Update record
    const { data: record, error } = await supabase
      .from("patient_records")
      // @ts-ignore - Supabase type inference issue
      .update({
        updated_by: user.id,
        ...normalizedUpdateData,
      })
      .eq("user_id", targetUserId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update patient record", error);
      return NextResponse.json({ error: "Unable to update patient record" }, { status: 400 });
    }

    await logAuditEvent({
      userId: user.id,
      action: "update_patient_record",
      resourceType: "patient_record",
      resourceId: (record as any)?.id,
      metadata: {
        target_user_id: targetUserId,
      },
      requestInfo: requestInfoFrom(request),
    });

    return NextResponse.json({ record }, { status: 200 });
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

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");

    if (!userId) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    const userRole = await getUserRole();
    const isSystemAdmin = userRole === "super_admin" || userRole === "admin";

    // Only admins can delete records
    if (!isSystemAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase
      .from("patient_records")
      .delete()
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await logAuditEvent({
      userId: user.id,
      action: "delete_patient_record",
      resourceType: "patient_record",
      resourceId: userId,
      requestInfo: requestInfoFrom(request),
    });

    return NextResponse.json({ message: "Patient record deleted successfully" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
