import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get("user_id");

    // If user_id is provided, check if requester is authorized
    let userId: string;
    if (requestedUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      
      // Allow if requesting own data or if no auth (for login flow)
      if (user && user.id !== requestedUserId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      userId = requestedUserId;
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = user.id;
    }

    // Fetch user data with only needed fields
    // @ts-ignore - Supabase type inference issue with users table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, full_name, role, two_factor_enabled, two_factor_backup_codes")
      .eq("id", userId)
      .single();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 400 });
    }

    // Fetch profile data
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, bio, avatar_url, created_at, updated_at")
      .eq("id", userId)
      .single();

    if (profileError && profileError.code !== "PGRST116") {
      // PGRST116 is "not found" - profile might not exist yet
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        user: userData,
        profile: profileData || null,
      },
      { status: 200 }
    );
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

    const body = await request.json();
    const { full_name, phone, bio, avatar_url } = body;

    // Update users table
    const userUpdate: any = {};
    if (full_name !== undefined) userUpdate.full_name = full_name;
    if (phone !== undefined) userUpdate.phone = phone;
    userUpdate.updated_at = new Date().toISOString();

    if (Object.keys(userUpdate).length > 1) {
      // @ts-ignore - Supabase type inference issue with users table
      const { error: userError } = await supabase
        .from("users")
        // @ts-ignore - Supabase type inference issue with users table
        .update(userUpdate)
        .eq("id", user.id);

      if (userError) {
        return NextResponse.json({ error: userError.message }, { status: 400 });
      }
    }

    // Update profiles table
    const profileUpdate: any = {};
    if (bio !== undefined) profileUpdate.bio = bio;
    if (avatar_url !== undefined) profileUpdate.avatar_url = avatar_url;
    profileUpdate.updated_at = new Date().toISOString();

    if (Object.keys(profileUpdate).length > 1) {
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          ...profileUpdate,
        });

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 400 });
      }
    }

    // Fetch updated data
    // @ts-ignore - Supabase type inference issue with users table
    const { data: userData } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    return NextResponse.json(
      {
        user: userData,
        profile: profileData || null,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
