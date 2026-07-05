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

export function isDoctor(userRole: UserRole | null): boolean {
  return userRole === "doctor";
}

export function isNurse(userRole: UserRole | null): boolean {
  return userRole === "nurse";
}

export function isClinicalStaff(userRole: UserRole | null): boolean {
  return (
    isAdmin(userRole) ||
    isDoctor(userRole) ||
    isNurse(userRole) ||
    userRole === "appointment_manager"
  );
}

export function isAdmin(userRole: UserRole | null): boolean {
  // NOTE: Broad admin/back-office check used by legacy routes.
  // Prefer section-based capability checks (canAccessSection) for PHI-sensitive APIs.
  return hasRole(userRole, [
    "super_admin",
    "admin",
    "content_manager",
    "appointment_manager",
    "finance_manager",
  ]);
}

export function isSystemAdmin(userRole: UserRole | null): boolean {
  return hasRole(userRole, ["super_admin", "admin"]);
}

export function isSuperAdmin(userRole: UserRole | null): boolean {
  return userRole === "super_admin";
}

export function isUserOnly(userRole: UserRole | null): boolean {
  return userRole === "user";
}

/**
 * Roles for which 2FA enrollment is mandatory. Any role with privileged access
 * to PHI, scheduling, or financial data is included; the patient-only "user"
 * role is exempt (2FA is still available to them via security settings, just
 * not enforced). Update this list in lock-step with `lib/proxy.ts`.
 */
export const STAFF_ROLES_REQUIRING_2FA: ReadonlyArray<UserRole> = [
  "super_admin",
  "admin",
  "doctor",
  "nurse",
  "content_manager",
  "appointment_manager",
  "finance_manager",
];

export function requires2FA(userRole: UserRole | null | undefined): boolean {
  if (!userRole) return false;
  return STAFF_ROLES_REQUIRING_2FA.includes(userRole);
}

// Re-export capability helpers for consistent RBAC usage (server)
export {
  canAccessSection,
  canAccessAuditLogs,
  canAccessPaymentLedger,
  getAdminSectionsForRole,
} from "@/lib/auth/role-capabilities";
export type { AdminSection } from "@/lib/auth/role-capabilities";

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
