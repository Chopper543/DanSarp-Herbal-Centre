import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { UserRole } from "@/types";
import crypto from "crypto";

type InviteRecord = {
  id: string;
  email: string;
  role: string;
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

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

  const typedData = data as InviteRecord | null;

  if (!typedData) {
    throw new Error("Failed to create invite: No data returned");
  }

  return { ...typedData, inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/invite/${token}` };
}

export async function validateInviteToken(token: string) {
  // Invite acceptance must work for non-admin users, so token validation uses
  // service role instead of auth-scoped RLS.
  const supabase = createServiceClient();

  // @ts-ignore - Supabase type inference issue with admin_invites table
  const { data, error } = await supabase
    .from("admin_invites")
    .select("*")
    .eq("token", token)
    .single();

  if (error || !data) {
    return null;
  }

  const typedData = data as InviteRecord | null;

  if (!typedData) {
    return null;
  }

  // Check if expired
  if (new Date(typedData.expires_at) < new Date()) {
    return null;
  }

  // Check if already accepted
  if (typedData.accepted_at) {
    return null;
  }

  return typedData;
}

export async function acceptInvite(token: string, userId: string) {
  // Accept flow mutates both users and invites and must not depend on caller RLS.
  const supabase = createServiceClient();

  const invite = await validateInviteToken(token);
  if (!invite) {
    throw new Error("Invalid or expired invite token");
  }

   // Ensure the user's email matches the invite email
  const { data: userRecord } = await supabase
    .from("users")
    .select("email")
    .eq("id", userId)
    .single();

  const userEmail = ((userRecord as any)?.email || "").toLowerCase();
  if (!userEmail || userEmail !== invite.email.toLowerCase()) {
    throw new Error("Invite email does not match the signed-in user");
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

export async function revokeInvite(inviteId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("admin_invites").delete().eq("id", inviteId);
  if (error) {
    throw new Error(`Failed to revoke invite: ${error.message}`);
  }
}
