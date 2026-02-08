import { UserRole } from "@/types";

export type AdminSection =
  | "dashboard"
  | "appointments"
  | "content"
  | "payments"
  | "users"
  | "patient_records"
  | "newsletter"
  | "messages"
  | "prescriptions"
  | "lab_results"
  | "clinical_notes"
  | "intake_forms"
  | "admins"
  | "invites"
  | "audit_logs"
  | "database"
  | "system";

/** Read-only for a section (e.g. nurse for clinical_notes). When true, UI can show view-only. */
export function isSectionReadOnly(role: UserRole | null, section: AdminSection): boolean {
  if (!role) return false;
  if (role === "nurse" && section === "clinical_notes") return true;
  return false;
}

const CAPABILITIES: Record<UserRole, AdminSection[]> = {
  super_admin: [
    "dashboard",
    "appointments",
    "content",
    "payments",
    "users",
    "patient_records",
    "newsletter",
    "messages",
    "prescriptions",
    "lab_results",
    "clinical_notes",
    "intake_forms",
    "admins",
    "invites",
    "audit_logs",
    "database",
    "system",
  ],
  admin: [
    "dashboard",
    "appointments",
    "content",
    "payments",
    "users",
    "patient_records",
    "newsletter",
    "messages",
    "prescriptions",
    "lab_results",
    "clinical_notes",
    "intake_forms",
    "audit_logs",
  ],
  content_manager: ["dashboard", "content", "newsletter"],
  appointment_manager: [
    "dashboard",
    "appointments",
    "patient_records",
    "messages",
    "intake_forms",
  ],
  finance_manager: ["dashboard", "payments"],
  doctor: [
    "dashboard",
    "appointments",
    "patient_records",
    "messages",
    "prescriptions",
    "lab_results",
    "clinical_notes",
    "intake_forms",
  ],
  nurse: [
    "dashboard",
    "appointments",
    "patient_records",
    "messages",
    "prescriptions",
    "lab_results",
    "clinical_notes",
    "intake_forms",
  ],
  user: [],
};

export function canAccessSection(
  role: UserRole | null,
  section: AdminSection
): boolean {
  if (!role) return false;
  const allowed = CAPABILITIES[role];
  if (!allowed) return false;
  return allowed.includes(section);
}

export function getAdminSectionsForRole(role: UserRole | null): AdminSection[] {
  if (!role) return [];
  return CAPABILITIES[role] ?? [];
}

/** Roles that can access audit logs (API guard). */
export function canAccessAuditLogs(role: UserRole | null): boolean {
  return role === "super_admin" || role === "admin";
}

/** Roles that can access payment ledger (API guard). */
export function canAccessPaymentLedger(role: UserRole | null): boolean {
  return (
    role === "super_admin" || role === "admin" || role === "finance_manager"
  );
}
