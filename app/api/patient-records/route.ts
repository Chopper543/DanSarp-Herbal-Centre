import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin } from "@/lib/auth/rbac";

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

      // @ts-ignore - Supabase type inference issue
      const { data: record, error } = await supabase
        .from("patient_records")
        .select("*")
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
    const { user_id, ...recordData } = body;

    // Check if user is admin
    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);

    // Only admins can create records for other users
    const targetUserId = user_id || user.id;
    if (targetUserId !== user.id && !isUserAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if record already exists
    // @ts-ignore - Supabase type inference issue
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
    // @ts-ignore - Supabase type inference issue
    const { data: record, error } = await supabase
      .from("patient_records")
      .insert({
        user_id: targetUserId,
        created_by: user.id,
        ...recordData,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

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
    const { user_id, ...updateData } = body;

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
    // @ts-ignore - Supabase type inference issue with patient_records table
    const { data: record, error } = await supabase
      .from("patient_records")
      // @ts-ignore - Supabase type inference issue
      .update({
        updated_by: user.id,
        ...updateData,
      })
      .eq("user_id", targetUserId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ record }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
