import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/rbac";

// GET - Get system information and statistics
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(["super_admin"]);
    const supabase = await createClient();

    // Get table statistics
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
    ];

    const stats: Record<string, any> = {};

    for (const table of tables) {
      try {
        // @ts-ignore - Supabase type inference issue
        const { count, error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });

        if (!error) {
          stats[table] = count || 0;
        }
      } catch (err) {
        stats[table] = null;
      }
    }

    // Get total revenue
    try {
      // @ts-ignore - Supabase type inference issue
      const { data: payments } = await supabase
        .from("payments")
        .select("amount")
        .eq("status", "completed");

      const revenue =
        payments?.reduce(
          (sum: number, p: any) => sum + parseFloat(p.amount?.toString() || "0"),
          0
        ) || 0;

      stats.revenue = revenue;
    } catch (err) {
      stats.revenue = 0;
    }

    // Get recent audit logs count (last 24 hours)
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // @ts-ignore - Supabase type inference issue
      const { count } = await supabase
        .from("audit_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", yesterday.toISOString());

      stats.recent_audit_logs = count || 0;
    } catch (err) {
      stats.recent_audit_logs = 0;
    }

    return NextResponse.json({ stats });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch system info" },
      { status: 401 }
    );
  }
}
