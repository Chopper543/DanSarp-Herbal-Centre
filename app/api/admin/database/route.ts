import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/rbac";

// GET - Get table list or execute read-only query
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(["super_admin"]);
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const table = searchParams.get("table");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (action === "tables") {
      // Return list of all tables
      const tables = [
        "users",
        "profiles",
        "appointments",
        "payments",
        "reviews",
        "messages",
        "blog_posts",
        "newsletter_subscribers",
        "gallery_items",
        "testimonials",
        "branches",
        "treatments",
        "admin_invites",
        "audit_logs",
        "organization_profile",
        "payment_ledger",
      ];

      const tableInfo = [];

      for (const tableName of tables) {
        try {
          // @ts-ignore - Supabase type inference issue
          const { count } = await supabase
            .from(tableName)
            .select("*", { count: "exact", head: true });

          tableInfo.push({
            name: tableName,
            rowCount: count || 0,
          });
        } catch (err) {
          tableInfo.push({
            name: tableName,
            rowCount: null,
            error: "Table not accessible",
          });
        }
      }

      return NextResponse.json({ tables: tableInfo });
    }

    if (action === "data" && table) {
      // Return data from a specific table
      // @ts-ignore - Supabase type inference issue
      const { data, error, count } = await supabase
        .from(table)
        .select("*", { count: "exact" })
        .range(offset, offset + limit - 1)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return NextResponse.json({
        data: data || [],
        total: count || 0,
        limit,
        offset,
      });
    }

    return NextResponse.json(
      { error: "Invalid action or missing parameters" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch database info" },
      { status: 401 }
    );
  }
}

// POST - Execute read-only SQL query (SELECT only)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(["super_admin"]);
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    // Security: Only allow SELECT queries
    const trimmedQuery = query.trim().toUpperCase();
    if (!trimmedQuery.startsWith("SELECT")) {
      return NextResponse.json(
        { error: "Only SELECT queries are allowed" },
        { status: 403 }
      );
    }

    // Additional security: Block dangerous keywords
    const dangerousKeywords = [
      "DROP",
      "DELETE",
      "UPDATE",
      "INSERT",
      "ALTER",
      "CREATE",
      "TRUNCATE",
      "EXEC",
      "EXECUTE",
    ];

    for (const keyword of dangerousKeywords) {
      if (trimmedQuery.includes(keyword)) {
        return NextResponse.json(
          { error: `Query contains forbidden keyword: ${keyword}` },
          { status: 403 }
        );
      }
    }

    // Execute query using Supabase RPC (if available) or direct query
    // Note: Supabase client doesn't support raw SQL directly
    // We'll need to use a different approach or limit to table queries
    return NextResponse.json(
      {
        error:
          "Direct SQL execution not available. Use table browser instead.",
      },
      { status: 501 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to execute query" },
      { status: 500 }
    );
  }
}
