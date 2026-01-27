import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin, isDoctor, isNurse } from "@/lib/auth/rbac";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const isStaff = Boolean(
      isUserAdmin ||
        userRole === "appointment_manager" ||
        isDoctor(userRole) ||
        isNurse(userRole)
    );

    // @ts-ignore
    const { data: labResult, error } = await supabase
      .from("lab_results")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Check permissions (patients see own; staff can see all)
    if (!isStaff && labResult.patient_id !== user.id && labResult.doctor_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ labResult }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const canUpdate = Boolean(
      isUserAdmin ||
        userRole === "appointment_manager" ||
        isDoctor(userRole) ||
        isNurse(userRole)
    );

    // Check if lab result exists and user has permission
    // @ts-ignore
    const { data: existingLabResult, error: fetchError } = await supabase
      .from("lab_results")
      .select("*")
      .eq("id", params.id)
      .single();

    if (fetchError || !existingLabResult) {
      return NextResponse.json({ error: "Lab result not found" }, { status: 404 });
    }

    // Check permissions (clinical staff can update; otherwise only assigned doctor)
    if (!canUpdate && existingLabResult.doctor_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const updatePayload = {
      ...body,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    // @ts-ignore
    const { data: labResult, error } = await supabase
      .from("lab_results")
      .update(updatePayload)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ labResult }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Only admins can delete
    if (!isUserAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // @ts-ignore
    const { error } = await supabase.from("lab_results").delete().eq("id", params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Lab result deleted successfully" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
