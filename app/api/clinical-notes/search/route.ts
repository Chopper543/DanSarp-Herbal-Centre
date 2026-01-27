import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin } from "@/lib/auth/rbac";

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
    const query = searchParams.get("q");
    const patientId = searchParams.get("patient_id");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 });
    }

    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);

    let searchQuery = supabase
      .from("clinical_notes")
      .select("*", { count: "exact" })
      .eq("is_template", false);

    // Filter by patient_id if provided
    if (patientId) {
      if (!isUserAdmin && patientId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      searchQuery = searchQuery.eq("patient_id", patientId);
    } else if (!isUserAdmin) {
      // Regular users can only search their own notes
      searchQuery = searchQuery.eq("patient_id", user.id);
    }

    // Full-text search using PostgreSQL text search
    // Search across all text fields
    searchQuery = searchQuery.or(
      `subjective.ilike.%${query}%,objective.ilike.%${query}%,assessment.ilike.%${query}%,plan.ilike.%${query}%`
    );

    searchQuery = searchQuery.limit(limit).order("created_at", { ascending: false });

    // @ts-ignore
    const { data: notes, error, count } = await searchQuery;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        notes: notes || [],
        total: count || 0,
        query,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
