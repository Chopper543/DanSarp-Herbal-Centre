import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin } from "@/lib/auth/rbac";
import { sanitizeText } from "@/lib/utils/sanitize";
import { z } from "zod";

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Invalid time format")
  .optional()
  .nullable();

const AvailabilityCreateSchema = z
  .object({
    doctor_id: z.string().uuid().optional(),
    type: z.enum(["working_hours", "time_off", "holiday", "emergency"]).optional(),
    day_of_week: z.number().int().min(0).max(6).optional().nullable(),
    start_time: timeSchema,
    end_time: timeSchema,
    start_date: z.string().date().optional().nullable(),
    end_date: z.string().date().optional().nullable(),
    start_datetime: z.string().datetime().optional().nullable(),
    end_datetime: z.string().datetime().optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    reason: z.string().max(2000).optional().nullable(),
    is_active: z.boolean().optional(),
  })
  .strict();

const AvailabilityUpdateSchema = AvailabilityCreateSchema.extend({
  id: z.string().uuid(),
}).strict();

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
    const doctorId = searchParams.get("doctor_id");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);

    let query = supabase.from("doctor_availability").select("*");

    if (doctorId) {
      if (!isUserAdmin && doctorId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      query = query.eq("doctor_id", doctorId);
    } else if (!isUserAdmin) {
      query = query.eq("doctor_id", user.id);
    }

    query = query.eq("is_active", true);

    if (startDate) {
      query = query.gte("start_date", startDate);
    }
    if (endDate) {
      query = query.lte("end_date", endDate);
    }

    // @ts-ignore
    const { data: availability, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ availability: availability || [] }, { status: 200 });
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

    const body = await request.json();
    const parsed = AvailabilityCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid availability payload", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { doctor_id, ...availabilityData } = parsed.data;

    const targetDoctorId = doctor_id || user.id;

    if (!isUserAdmin && targetDoctorId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = {
      doctor_id: targetDoctorId,
      ...availabilityData,
      notes: availabilityData.notes ? sanitizeText(availabilityData.notes) : availabilityData.notes ?? null,
      reason: availabilityData.reason
        ? sanitizeText(availabilityData.reason)
        : availabilityData.reason ?? null,
      created_by: user.id,
    };

    // @ts-ignore
    const { data: availability, error } = await supabase
      .from("doctor_availability")
      // @ts-ignore - Supabase type inference issue
      .insert(data)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ availability }, { status: 201 });
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
    const parsed = AvailabilityUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid availability update payload", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { id, ...updateData } = parsed.data;

    if (!id) {
      return NextResponse.json({ error: "Availability ID is required" }, { status: 400 });
    }

    // @ts-ignore
    const { data: existing, error: fetchError } = await supabase
      .from("doctor_availability")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Availability not found" }, { status: 404 });
    }

    const existingAvailability = existing as { doctor_id: string } | null;
    if (!isUserAdmin && existingAvailability?.doctor_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatePayload: any = {
      ...updateData,
      notes: updateData.notes ? sanitizeText(updateData.notes) : updateData.notes ?? null,
      reason: updateData.reason ? sanitizeText(updateData.reason) : updateData.reason ?? null,
    };

    // @ts-ignore
    const { data: availability, error } = await supabase
      .from("doctor_availability")
      // @ts-ignore - Supabase type inference issue
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ availability }, { status: 200 });
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
      return NextResponse.json({ error: "Availability ID is required" }, { status: 400 });
    }

    // @ts-ignore
    const { data: existing, error: fetchError } = await supabase
      .from("doctor_availability")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Availability not found" }, { status: 404 });
    }

    const existingAvailability = existing as { doctor_id: string } | null;
    if (!isUserAdmin && existingAvailability?.doctor_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Soft delete
    // @ts-ignore
    const { error } = await supabase
      .from("doctor_availability")
      // @ts-ignore - Supabase type inference issue
      .update({ is_active: false } as any)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Availability deleted successfully" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
