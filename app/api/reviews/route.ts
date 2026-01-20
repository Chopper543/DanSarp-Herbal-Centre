import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin, isUserOnly } from "@/lib/auth/rbac";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is a regular user (not staff)
    const userRole = await getUserRole();
    if (!isUserOnly(userRole)) {
      return NextResponse.json(
        { error: "Staff members cannot leave reviews. Please use the admin panel." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { rating, title, content } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
    }

    const { data: review, error } = await supabase
      .from("reviews")
      // @ts-ignore - Supabase type inference issue with reviews table
      .insert({
        user_id: user.id,
        rating,
        title,
        content,
        is_approved: false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ review }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const approvedOnly = searchParams.get("approved") !== "false";

    // @ts-ignore - Supabase type inference issue with reviews table
    let query = supabase.from("reviews").select("*, user:users(full_name)");

    if (approvedOnly) {
      query = query.eq("is_approved", true);
    }

    // @ts-ignore - Supabase type inference issue with reviews table
    const { data: reviews, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ reviews }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = await getUserRole();
    if (!isAdmin(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, is_approved, admin_notes } = body;

    if (!id) {
      return NextResponse.json({ error: "Review ID is required" }, { status: 400 });
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (typeof is_approved === "boolean") {
      updateData.is_approved = is_approved;
    }

    if (admin_notes !== undefined) {
      updateData.admin_notes = admin_notes;
    }

    // @ts-ignore - Supabase type inference issue with reviews table
    const { data: review, error } = await supabase
      .from("reviews")
      // @ts-ignore - Supabase type inference issue
      .update(updateData)
      .eq("id", id)
      .select("*, user:users(full_name)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ review }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
