import { UserRole } from "@/types";
import { createClient } from "@/lib/supabase/server";

export async function getUserRole(): Promise<UserRole | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // @ts-ignore - Supabase type inference issue with users table
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const typedData = data as { role: string } | null;
  return (typedData?.role as UserRole) || null;
}

export function hasRole(userRole: UserRole | null, requiredRoles: UserRole[]): boolean {
  if (!userRole) return false;
  return requiredRoles.includes(userRole);
}

export function isAdmin(userRole: UserRole | null): boolean {
  return hasRole(userRole, [
    "super_admin",
    "admin",
    "content_manager",
    "appointment_manager",
    "finance_manager",
  ]);
}

export function isSuperAdmin(userRole: UserRole | null): boolean {
  return userRole === "super_admin";
}

export function isUserOnly(userRole: UserRole | null): boolean {
  return userRole === "user";
}

export async function requireAuth(requiredRoles?: UserRole[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  if (requiredRoles) {
    const userRole = await getUserRole();
    if (!userRole || !hasRole(userRole, requiredRoles)) {
      throw new Error("Forbidden");
    }
  }

  return user;
}
