import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/audit/log";
import { z } from "zod";
import { sanitizeText } from "@/lib/utils/sanitize";
import { logger } from "@/lib/monitoring/logger";

const requestInfoFrom = (request: NextRequest) => ({
  ip:
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    null,
  userAgent: request.headers.get("user-agent"),
  path: request.nextUrl.pathname,
});

const PatientRecordSchema = z
  .object({
    user_id: z.string().uuid().optional(),
    primary_condition: z.string().max(500).optional().nullable(),
    condition_started_date: z.string().date().optional().nullable(),
    medical_history: z.string().max(8000).optional().nullable(),
    doctor_notes: z.string().max(8000).optional().nullable(),
    allergies: z.string().max(2000).optional().nullable(),
    current_medications: z.string().max(2000).optional().nullable(),
    blood_type: z.string().max(10).optional().nullable(),
    last_visit_date: z.string().date().optional().nullable(),
    emergency_contact_name: z.string().max(200).optional().nullable(),
    emergency_contact_phone: z.string().max(50).optional().nullable(),
    address: z.string().max(500).optional().nullable(),
    occupation: z.string().max(200).optional().nullable(),
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
    const userId = searchParams.get("user_id");

    // If user_id is provided, get that specific record
    if (userId) {
      const userRole = await getUserRole();
      const isUserAdmin = userRole && isAdmin(userRole);
      
      // Only allow if user is admin or requesting their own record
      if (!isUserAdmin && userId !== user.id) {
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
    const isUserAdmin = userRole && isAdmin(userRole);

    if (isUserAdmin) {
      // Admins can get all records
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
    const parsed = PatientRecordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid patient record payload", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { user_id, ...recordData } = parsed.data;

    // Check if user is admin
    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);

    // Only admins can create records for other users
    const targetUserId = user_id || user.id;
    if (targetUserId !== user.id && !isUserAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
      .insert({
        user_id: targetUserId,
        created_by: user.id,
        ...recordData,
        primary_condition: recordData.primary_condition
          ? sanitizeText(recordData.primary_condition)
          : recordData.primary_condition ?? null,
        medical_history: recordData.medical_history
          ? sanitizeText(recordData.medical_history)
          : recordData.medical_history ?? null,
        doctor_notes: recordData.doctor_notes
          ? sanitizeText(recordData.doctor_notes)
          : recordData.doctor_notes ?? null,
        allergies: recordData.allergies ? sanitizeText(recordData.allergies) : recordData.allergies ?? null,
        current_medications: recordData.current_medications
          ? sanitizeText(recordData.current_medications)
          : recordData.current_medications ?? null,
        emergency_contact_name: recordData.emergency_contact_name
          ? sanitizeText(recordData.emergency_contact_name)
          : recordData.emergency_contact_name ?? null,
        emergency_contact_phone: recordData.emergency_contact_phone
          ? sanitizeText(recordData.emergency_contact_phone)
          : recordData.emergency_contact_phone ?? null,
        address: recordData.address ? sanitizeText(recordData.address) : recordData.address ?? null,
        occupation: recordData.occupation ? sanitizeText(recordData.occupation) : recordData.occupation ?? null,
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
    const parsed = PatientRecordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid patient record update payload", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { user_id, ...updateData } = parsed.data;

    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);

    const targetUserId = user_id || user.id;

    // Check permissions
    if (targetUserId !== user.id && !isUserAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If user is not an admin, prevent updating medical fields
    if (!isUserAdmin && targetUserId === user.id) {
      const medicalFields = [
        'primary_condition',
        'condition_started_date',
        'medical_history',
        'doctor_notes',
        'allergies',
        'current_medications',
        'blood_type'
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

    // Update record
    const { data: record, error } = await supabase
      .from("patient_records")
      // @ts-ignore - Supabase type inference issue
      .update({
        updated_by: user.id,
        ...updateData,
        primary_condition: updateData.primary_condition
          ? sanitizeText(updateData.primary_condition)
          : updateData.primary_condition ?? null,
        medical_history: updateData.medical_history
          ? sanitizeText(updateData.medical_history)
          : updateData.medical_history ?? null,
        doctor_notes: updateData.doctor_notes
          ? sanitizeText(updateData.doctor_notes)
          : updateData.doctor_notes ?? null,
        allergies: updateData.allergies ? sanitizeText(updateData.allergies) : updateData.allergies ?? null,
        current_medications: updateData.current_medications
          ? sanitizeText(updateData.current_medications)
          : updateData.current_medications ?? null,
        emergency_contact_name: updateData.emergency_contact_name
          ? sanitizeText(updateData.emergency_contact_name)
          : updateData.emergency_contact_name ?? null,
        emergency_contact_phone: updateData.emergency_contact_phone
          ? sanitizeText(updateData.emergency_contact_phone)
          : updateData.emergency_contact_phone ?? null,
        address: updateData.address ? sanitizeText(updateData.address) : updateData.address ?? null,
        occupation: updateData.occupation ? sanitizeText(updateData.occupation) : updateData.occupation ?? null,
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
    const isUserAdmin = userRole && isAdmin(userRole);

    // Only admins can delete records
    if (!isUserAdmin) {
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
