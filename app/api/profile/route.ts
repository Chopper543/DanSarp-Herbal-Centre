import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/audit/log";
import { internalError, badRequest } from "@/lib/api/errors";

const PROFILE_READ_ADMIN_ROLES = new Set(["super_admin", "admin"]);

const requestInfoFrom = (request: NextRequest) => ({
  ip:
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    null,
  userAgent: request.headers.get("user-agent"),
  path: request.nextUrl.pathname,
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get("user_id");

    // Always require auth. The previous "no auth = self-id" path let
    // anonymous callers fetch any user_id (PII enumeration by ID guessing).
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let userId: string;
    let crossUserRead = false;

    if (requestedUserId && requestedUserId !== user.id) {
      const role = await getUserRole();
      if (!role || !PROFILE_READ_ADMIN_ROLES.has(role)) {
        // Audit the attempt so suspicious profile-peeking is forensically visible.
        await logAuditEvent({
          userId: user.id,
          action: "profile_read_forbidden",
          resourceType: "user",
          resourceId: requestedUserId,
          metadata: { attempted_role: role ?? null },
          requestInfo: requestInfoFrom(request),
        });
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      crossUserRead = true;
      userId = requestedUserId;
    } else {
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
      return badRequest("/api/profile", userError);
    }

    // Fetch profile data
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, bio, avatar_url, created_at, updated_at")
      .eq("id", userId)
      .single();

    if (profileError && profileError.code !== "PGRST116") {
      // PGRST116 is "not found" - profile might not exist yet
      return badRequest("/api/profile", profileError);
    }

    if (crossUserRead) {
      await logAuditEvent({
        userId: user.id,
        action: "admin_read_profile",
        resourceType: "user",
        resourceId: userId,
        requestInfo: requestInfoFrom(request),
      });
    }

    return NextResponse.json(
      {
        user: userData,
        profile: profileData || null,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return internalError("/api/profile", error);
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
        return badRequest("/api/profile", userError);
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
        return badRequest("/api/profile", profileError);
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
    return internalError("/api/profile", error);
  }
}
