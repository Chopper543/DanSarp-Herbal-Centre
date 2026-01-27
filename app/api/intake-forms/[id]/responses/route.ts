import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin } from "@/lib/auth/rbac";
import { IntakeFormResponse } from "@/types";

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

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patient_id");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);

    let query = supabase
      .from("intake_form_responses")
      .select("*", { count: "exact" })
      .eq("form_id", params.id);

    // Filter by patient_id if provided
    if (patientId) {
      if (!isUserAdmin && patientId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      query = query.eq("patient_id", patientId);
    } else if (!isUserAdmin) {
      // Regular users can only see their own responses
      query = query.eq("patient_id", user.id);
    }

    // Filter by status
    if (status) {
      query = query.eq("status", status);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to).order("created_at", { ascending: false });

    // @ts-ignore
    const { data: responses, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        responses: responses || [],
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

export async function POST(
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

    const body = await request.json();
    const { appointment_id, response_data, status } = body;

    // Validation
    if (!response_data || typeof response_data !== "object") {
      return NextResponse.json(
        { error: "Response data is required" },
        { status: 400 }
      );
    }

    // Verify form exists and is active
    // @ts-ignore
    const { data: form, error: formError } = await supabase
      .from("intake_forms")
      .select("*")
      .eq("id", params.id)
      .single();

    if (formError || !form) {
      return NextResponse.json({ error: "Intake form not found" }, { status: 404 });
    }

    // Check if form is active (for non-admins)
    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);
    if (!isUserAdmin && !form.is_active) {
      return NextResponse.json({ error: "This form is not currently active" }, { status: 403 });
    }

    // Check if user already has a draft response
    // @ts-ignore
    const { data: existingResponse } = await supabase
      .from("intake_form_responses")
      .select("*")
      .eq("form_id", params.id)
      .eq("patient_id", user.id)
      .eq("status", "draft")
      .single();

    let responseData: any;
    if (existingResponse) {
      // Update existing draft
      responseData = {
        response_data,
        status: status || "draft",
        submitted_at: status === "submitted" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      // @ts-ignore
      const { data: updatedResponse, error: updateError } = await supabase
        .from("intake_form_responses")
        .update(responseData)
        .eq("id", existingResponse.id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      return NextResponse.json({ response: updatedResponse }, { status: 200 });
    } else {
      // Create new response
      responseData = {
        form_id: params.id,
        patient_id: user.id,
        appointment_id: appointment_id || null,
        response_data,
        status: status || "draft",
        submitted_at: status === "submitted" ? new Date().toISOString() : null,
      };

      // @ts-ignore
      const { data: newResponse, error: insertError } = await supabase
        .from("intake_form_responses")
        .insert(responseData)
        .select()
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 });
      }

      return NextResponse.json({ response: newResponse }, { status: 201 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
