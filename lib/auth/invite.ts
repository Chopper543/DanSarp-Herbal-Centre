import { createClient } from "@/lib/supabase/server";
import { UserRole } from "@/types";
import crypto from "crypto";

export async function createAdminInvite(
  email: string,
  role: UserRole,
  invitedBy: string
) {
  const supabase = await createClient();

  // Generate secure token
  const token = crypto.randomBytes(32).toString("hex");

  // Set expiration to 7 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data, error } = await supabase
    .from("admin_invites")
    // @ts-ignore - Supabase type inference issue with admin_invites table
    .insert({
      email,
      role,
      token,
      invited_by: invitedBy,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create invite: ${error.message}`);
  }

  return { ...data, inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/invite/${token}` };
}

export async function validateInviteToken(token: string) {
  const supabase = await createClient();

  // @ts-ignore - Supabase type inference issue with admin_invites table
  const { data, error } = await supabase
    .from("admin_invites")
    .select("*")
    .eq("token", token)
    .single();

  if (error || !data) {
    return null;
  }

  // Check if expired
  if (new Date(data.expires_at) < new Date()) {
    return null;
  }

  // Check if already accepted
  if (data.accepted_at) {
    return null;
  }

  return data;
}

export async function acceptInvite(token: string, userId: string) {
  const supabase = await createClient();

  const invite = await validateInviteToken(token);
  if (!invite) {
    throw new Error("Invalid or expired invite token");
  }

  // Update user role
  const { error: userError } = await supabase
    .from("users")
    // @ts-ignore - Supabase type inference issue with users table
    .update({ role: invite.role })
    .eq("id", userId);

  if (userError) {
    throw new Error(`Failed to update user role: ${userError.message}`);
  }

  // Mark invite as accepted
  const { error: inviteError } = await supabase
    .from("admin_invites")
    // @ts-ignore - Supabase type inference issue with admin_invites table
    .update({ accepted_at: new Date().toISOString() })
    .eq("token", token);

  if (inviteError) {
    throw new Error(`Failed to mark invite as accepted: ${inviteError.message}`);
  }

  return true;
}
