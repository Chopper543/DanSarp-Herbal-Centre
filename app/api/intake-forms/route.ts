import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin } from "@/lib/auth/rbac";
import { IntakeForm, FormSchema } from "@/types";
import { z } from "zod";

const IntakeFormCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  form_schema: z
    .object({
      fields: z.array(z.any()).min(1, "Form schema must contain at least one field"),
    })
    .passthrough(),
  is_active: z.boolean().optional(),
  required_for_booking: z.boolean().optional(),
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
    const formId = searchParams.get("id");
    const includeInactive = searchParams.get("include_inactive") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);

    let query = supabase.from("intake_forms").select("*", { count: "exact" });

    // If requesting specific form
    if (formId) {
      // @ts-ignore
      const { data: form, error } = await supabase
        .from("intake_forms")
        .select("*")
        .eq("id", formId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Check permissions - only active forms are visible to non-admins
      const typedForm = form as { is_active: boolean } | null;
      if (!isUserAdmin && !typedForm?.is_active) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      return NextResponse.json({ form }, { status: 200 });
    }

    // Filter active forms for non-admins
    if (!includeInactive && !isUserAdmin) {
      query = query.eq("is_active", true);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to).order("created_at", { ascending: false });

    // @ts-ignore
    const { data: forms, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        forms: forms || [],
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

    // Only admins and content managers can create intake forms
    if (!isUserAdmin && userRole !== "content_manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = IntakeFormCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid intake form payload", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, description, form_schema, is_active, required_for_booking } = parsed.data;

    // Create intake form
    const formData = {
      name,
      description: description || null,
      form_schema: form_schema as FormSchema,
      is_active: is_active !== undefined ? is_active : true,
      required_for_booking: Boolean(required_for_booking),
      created_by: user.id,
    };

    // @ts-ignore
    const { data: form, error } = await supabase
      .from("intake_forms")
      // @ts-ignore - Supabase type inference issue
      .insert(formData as any)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ form }, { status: 201 });
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
      return NextResponse.json({ error: "Intake form ID is required" }, { status: 400 });
    }

    // Check if form exists
    // @ts-ignore
    const { data: existingForm, error: fetchError } = await supabase
      .from("intake_forms")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingForm) {
      return NextResponse.json({ error: "Intake form not found" }, { status: 404 });
    }

    // Only admins and content managers can update
    if (!isUserAdmin && userRole !== "content_manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update form
    const updatePayload = {
      ...updateData,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    // @ts-ignore
    const { data: form, error } = await supabase
      .from("intake_forms")
      // @ts-ignore - Supabase type inference issue
      .update(updatePayload as any)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ form }, { status: 200 });
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
      return NextResponse.json({ error: "Intake form ID is required" }, { status: 400 });
    }

    // Check if form exists
    // @ts-ignore
    const { data: existingForm, error: fetchError } = await supabase
      .from("intake_forms")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingForm) {
      return NextResponse.json({ error: "Intake form not found" }, { status: 404 });
    }

    // Only admins can delete intake forms
    if (!isUserAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Hard delete
    // @ts-ignore
    const { error } = await supabase.from("intake_forms").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Intake form deleted successfully" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
