import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin } from "@/lib/auth/rbac";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // @ts-ignore - Supabase type inference issue with organization_profile table
    const { data: profile, error } = await supabase
      .from("organization_profile")
      .select("*")
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found" - profile might not exist yet
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ profile: profile || null }, { status: 200 });
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
    if (!isAdmin(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { mission, vision, values, team_members, certifications } = body;

    if (!mission || !vision || !values) {
      return NextResponse.json(
        { error: "Mission, vision, and values are required" },
        { status: 400 }
      );
    }

    // Check if profile already exists
    // @ts-ignore - Supabase type inference issue
    const { data: existing } = await supabase
      .from("organization_profile")
      .select("id")
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Organization profile already exists. Use PATCH to update." },
        { status: 400 }
      );
    }

    // @ts-ignore - Supabase type inference issue with organization_profile table
    const { data: profile, error } = await supabase
      .from("organization_profile")
      // @ts-ignore - Supabase type inference issue
      .insert({
        mission,
        vision,
        values,
        team_members: team_members || [],
        certifications: certifications || [],
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ profile }, { status: 201 });
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

    const userRole = await getUserRole();
    if (!isAdmin(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { mission, vision, values, team_members, certifications } = body;

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (mission !== undefined) updateData.mission = mission;
    if (vision !== undefined) updateData.vision = vision;
    if (values !== undefined) updateData.values = values;
    if (team_members !== undefined) updateData.team_members = team_members;
    if (certifications !== undefined) updateData.certifications = certifications;

    // @ts-ignore - Supabase type inference issue with organization_profile table
    const { data: profile, error } = await supabase
      .from("organization_profile")
      // @ts-ignore - Supabase type inference issue
      .update(updateData)
      .select()
      .single();

    if (error) {
      // If profile doesn't exist, create it
      if (error.code === "PGRST116" && mission && vision && values) {
        // @ts-ignore - Supabase type inference issue
        const { data: newProfile, error: createError } = await supabase
          .from("organization_profile")
          // @ts-ignore - Supabase type inference issue
          .insert({
            mission,
            vision,
            values,
            team_members: team_members || [],
            certifications: certifications || [],
          })
          .select()
          .single();

        if (createError) {
          return NextResponse.json({ error: createError.message }, { status: 400 });
        }

        return NextResponse.json({ profile: newProfile }, { status: 200 });
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
