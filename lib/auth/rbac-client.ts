"use client";

import { UserRole } from "@/types";
import { createClient } from "@/lib/supabase/client";

export async function getUserRole(): Promise<UserRole | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  return (data?.role as UserRole) || null;
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
