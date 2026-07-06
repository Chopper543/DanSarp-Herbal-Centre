import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/audit/log";
import { badRequest, authAwareError } from "@/lib/api/errors";

/** GET - List all users. Only roles with "users" capability (super_admin, admin) may access. */
export async function GET(request: Request) {
  try {
    const authedUser = await requireAuth(["super_admin", "admin"]);
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
      return badRequest("/api/admin/users", error);
    }

    await logAuditEvent({
      userId: authedUser.id,
      action: "admin_list_users",
      resourceType: "user",
      metadata: { page, limit, result_count: users?.length ?? 0, total: count ?? 0 },
      requestInfo: {
        ip:
          request.headers.get("x-forwarded-for")?.split(",")[0] ||
          request.headers.get("x-real-ip") ||
          null,
        userAgent: request.headers.get("user-agent"),
        path: new URL(request.url).pathname,
      },
    });

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
    return authAwareError("GET /api/admin/users", error, "Failed to fetch users");
  }
}
