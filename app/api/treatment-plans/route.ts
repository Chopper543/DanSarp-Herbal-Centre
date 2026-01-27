import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin, isDoctor } from "@/lib/auth/rbac";
import { TreatmentPlan } from "@/types";

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
    const planId = searchParams.get("id");
    const patientId = searchParams.get("patient_id");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);

    let query = supabase.from("treatment_plans").select("*", { count: "exact" });

    if (planId) {
      query = query.eq("id", planId).single();
      // @ts-ignore
      const { data: plan, error } = await query;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      if (!isUserAdmin && plan.patient_id !== user.id && plan.doctor_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      return NextResponse.json({ treatment_plan: plan }, { status: 200 });
    }

    if (patientId) {
      if (!isUserAdmin && patientId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      query = query.eq("patient_id", patientId);
    } else if (!isUserAdmin) {
      query = query.eq("patient_id", user.id);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to).order("start_date", { ascending: false });

    // @ts-ignore
    const { data: plans, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        treatment_plans: plans || [],
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

    // Treatment plans can be created by doctor + appointment_manager + admin (nurse cannot)
    const canCreate = Boolean(
      isUserAdmin || userRole === "appointment_manager" || isDoctor(userRole)
    );
    if (!canCreate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      patient_id,
      appointment_id,
      title,
      description,
      diagnosis,
      goals,
      treatment_approach,
      start_date,
      end_date,
      estimated_duration_days,
      follow_up_required,
      follow_up_interval_days,
      doctor_notes,
    } = body;

    if (!patient_id || !title || !start_date) {
      return NextResponse.json(
        { error: "Patient ID, title, and start date are required" },
        { status: 400 }
      );
    }

    const planData = {
      patient_id,
      doctor_id: user.id,
      appointment_id: appointment_id || null,
      title,
      description: description || null,
      diagnosis: diagnosis || null,
      goals: goals || [],
      treatment_approach: treatment_approach || null,
      start_date,
      end_date: end_date || null,
      estimated_duration_days: estimated_duration_days || null,
      status: "active" as const,
      progress_notes: [],
      current_progress: 0,
      follow_up_required: follow_up_required || false,
      follow_up_interval_days: follow_up_interval_days || null,
      next_follow_up_date: follow_up_required && follow_up_interval_days
        ? new Date(new Date(start_date).getTime() + follow_up_interval_days * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0]
        : null,
      doctor_notes: doctor_notes || null,
      created_by: user.id,
    };

    // @ts-ignore
    const { data: plan, error } = await supabase
      .from("treatment_plans")
      .insert(planData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ treatment_plan: plan }, { status: 201 });
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
      return NextResponse.json({ error: "Treatment plan ID is required" }, { status: 400 });
    }

    // @ts-ignore
    const { data: existingPlan, error: fetchError } = await supabase
      .from("treatment_plans")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingPlan) {
      return NextResponse.json({ error: "Treatment plan not found" }, { status: 404 });
    }

    if (!isUserAdmin && existingPlan.doctor_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatePayload = {
      ...updateData,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    // @ts-ignore
    const { data: plan, error } = await supabase
      .from("treatment_plans")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ treatment_plan: plan }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
