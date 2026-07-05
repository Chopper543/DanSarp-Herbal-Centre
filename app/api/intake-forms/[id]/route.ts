import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin } from "@/lib/auth/rbac";
import { internalError, badRequest } from "@/lib/api/errors";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);

    // @ts-ignore - supabase type inference
    const { data: form, error } = await supabase
      .from("intake_forms")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return badRequest("/api/intake-forms/[id]", error);
    }

    // Check permissions - only active forms are visible to non-admins
    const typedForm = form as { is_active: boolean } | null;
    if (!isUserAdmin && !typedForm?.is_active) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ form }, { status: 200 });
  } catch (error: any) {
    return internalError("/api/intake-forms/[id]", error);
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);

    // Check if form exists
    // @ts-ignore - supabase type inference
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

    const body = await request.json();
    const updatePayload = {
      ...body,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    // @ts-ignore - supabase type inference
    const { data: form, error } = await supabase
      .from("intake_forms")
      // @ts-ignore - Supabase type inference issue
      .update(updatePayload as any)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return badRequest("/api/intake-forms/[id]", error);
    }

    return NextResponse.json({ form }, { status: 200 });
  } catch (error: any) {
    return internalError("/api/intake-forms/[id]", error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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

    // @ts-ignore - supabase type inference
    const { error } = await supabase.from("intake_forms").delete().eq("id", id);

    if (error) {
      return badRequest("/api/intake-forms/[id]", error);
    }

    return NextResponse.json({ message: "Intake form deleted successfully" }, { status: 200 });
  } catch (error: any) {
    return internalError("/api/intake-forms/[id]", error);
  }
}
