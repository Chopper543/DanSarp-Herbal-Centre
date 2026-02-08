import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/rbac";
import { z } from "zod";

const UpdateRoleSchema = z.object({
  userId: z.string().uuid(),
  newRole: z.enum([
    "super_admin",
    "admin",
    "content_manager",
    "appointment_manager",
    "finance_manager",
    "doctor",
    "nurse",
    "user",
  ]),
});

// GET - List all admin users
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(["super_admin"]);
    const supabase = await createClient();

    // Fetch all users with admin roles
    // @ts-ignore - Supabase type inference issue
    const { data: admins, error } = await supabase
      .from("users")
      .select("*")
      .in("role", [
        "super_admin",
        "admin",
        "content_manager",
        "appointment_manager",
        "finance_manager",
      ])
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ admins });
  } catch (error: any) {
    const status = error.message === "Forbidden" ? 403 : 401;
    return NextResponse.json(
      { error: error.message || "Failed to fetch admins" },
      { status }
    );
  }
}

// POST - Update admin role
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(["super_admin"]);
    const supabase = await createClient();
    const body = await request.json();
    const parsed = UpdateRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { userId, newRole } = parsed.data;

    if (!userId || !newRole) {
      return NextResponse.json(
        { error: "userId and newRole are required" },
        { status: 400 }
      );
    }

    // Prevent changing super_admin role (only one super_admin allowed)
    // @ts-ignore - Supabase type inference issue
    const { data: targetUserData } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    const targetUser = targetUserData as { role: string } | null;

    if (targetUser?.role === "super_admin" && newRole !== "super_admin") {
      return NextResponse.json(
        { error: "Cannot change super_admin role" },
        { status: 403 }
      );
    }

    if (newRole === "super_admin") {
      // Demote existing super_admin first
      // @ts-ignore - Supabase type inference issue
      await supabase
        .from("users")
        // @ts-ignore - Supabase type inference issue
        .update({ role: "admin" })
        .eq("role", "super_admin")
        .neq("id", userId);
    }

    // Update user role
    // @ts-ignore - Supabase type inference issue
    const { data, error } = await supabase
      .from("users")
      // @ts-ignore - Supabase type inference issue
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;

    // Log action to audit_logs
    // @ts-ignore - Supabase type inference issue
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "update_admin_role",
      resource_type: "user",
      resource_id: userId,
      metadata: {
        old_role: targetUser?.role,
        new_role: newRole,
      },
    });

    return NextResponse.json({ user: data });
  } catch (error: any) {
    const status =
      error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json(
      { error: error.message || "Failed to update admin role" },
      { status }
    );
  }
}
