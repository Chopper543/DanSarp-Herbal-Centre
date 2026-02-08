import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { acceptInvite, validateInviteToken } from "@/lib/auth/invite";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const token = body?.token as string | undefined;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const invite = await validateInviteToken(token);
    if (!invite) {
      return NextResponse.json({ error: "Invalid or expired invite token" }, { status: 400 });
    }

    // Enforce that the authenticated user's email matches the invite email
    const authedEmail = (user.email || user.user_metadata?.email || "").toLowerCase();
    const inviteEmail = invite.email.toLowerCase();
    if (!authedEmail || authedEmail !== inviteEmail) {
      return NextResponse.json(
        { error: "Invite email does not match the signed-in user. Please sign in with the invited email." },
        { status: 403 }
      );
    }

    await acceptInvite(token, user.id);

    return NextResponse.json({
      message: "Invite accepted successfully",
      role: invite.role,
    });
  } catch (error: any) {
    console.error("Error accepting admin invite:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to accept invite" },
      { status: 500 }
    );
  }
}
