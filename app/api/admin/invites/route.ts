import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isSuperAdmin } from "@/lib/auth/rbac";
import crypto from "crypto";
import { sendAdminInviteEmail } from "@/lib/email/resend";
import { revokeInvite } from "@/lib/auth/invite";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getUserRole();
    const isUserSuperAdmin = userRole && isSuperAdmin(userRole);

    if (!isUserSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // "pending", "accepted", "all"

    let query = supabase
      .from("admin_invites")
      .select(`
        *,
        inviter:invited_by (
          id,
          email,
          full_name
        )
      `)
      .order("created_at", { ascending: false });

    if (status === "pending") {
      query = query.is("accepted_at", null);
    } else if (status === "accepted") {
      query = query.not("accepted_at", "is", null);
    }

    // @ts-ignore - Supabase type inference issue
    const { data: invites, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ invites }, { status: 200 });
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
    const isUserSuperAdmin = userRole && isSuperAdmin(userRole);

    if (!isUserSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 });
    }

    // Validate role
    const validRoles = ["admin", "content_manager", "appointment_manager", "finance_manager"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Check if user already exists
    // @ts-ignore - Supabase type inference issue
    const { data: existingUser } = await supabase.from("users").select("id").eq("email", email).single();

    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 });
    }

    // Check if there's already a pending invite for this email
    // @ts-ignore - Supabase type inference issue
    const { data: existingInvite } = await supabase
      .from("admin_invites")
      .select("id")
      .eq("email", email)
      .is("accepted_at", null)
      .single();

    if (existingInvite) {
      return NextResponse.json({ error: "A pending invite already exists for this email" }, { status: 400 });
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString("hex");

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // @ts-ignore - Supabase type inference issue with admin_invites table
    const { data: invite, error } = await supabase
      .from("admin_invites")
      // @ts-ignore - Supabase type inference issue
      .insert({
        email,
        role,
        token,
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const inviteLink = `${appUrl}/admin/invite/${token}`;

    try {
      await sendAdminInviteEmail({
        to: email,
        inviteLink,
        role,
        invitedBy: user.email || user.user_metadata?.full_name || null,
      });
    } catch (err: any) {
      console.error("Failed to send admin invite email:", err);
      return NextResponse.json(
        { error: "Invite created but email sending failed. Please retry or use the invite link.", invite, invite_link: inviteLink },
        { status: 500 }
      );
    }

    return NextResponse.json({ invite, invite_link: inviteLink }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getUserRole();
    const isUserSuperAdmin = userRole && isSuperAdmin(userRole);

    if (!isUserSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Invite ID is required" }, { status: 400 });
    }

    await revokeInvite(id);

    return NextResponse.json({ message: "Invite deleted successfully" }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
