import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/rbac";

/** GET - List all users. Only roles with "users" capability (super_admin, admin) may access. */
export async function GET(request: Request) {
  try {
    await requireAuth(["super_admin", "admin"]);
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
    const page = Math.max(Number(searchParams.get("page")) || 1, 1);
    const offset = (page - 1) * limit;

    // @ts-ignore - Supabase type inference issue with users table
    const { data: users, error, count } = await supabase
      .from("users")
      .select("id, email, full_name, role, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      users: users ?? [],
      pagination: {
        total: count ?? 0,
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 1,
      },
    });
  } catch (error: any) {
    const status =
      error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json(
      { error: error.message || "Failed to fetch users" },
      { status }
    );
  }
}
