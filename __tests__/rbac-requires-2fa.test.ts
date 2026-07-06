/**
 * @jest-environment node
 *
 * Locks the 2FA-required role list. If anyone adds a staff role and forgets
 * to require 2FA, this test fails. Patient-only "user" role must stay exempt
 * (2FA is available to them but not enforced).
 */
import { requires2FA, STAFF_ROLES_REQUIRING_2FA } from "../lib/auth/rbac";
import type { UserRole } from "@/types";

describe("requires2FA", () => {
  const staffRoles: UserRole[] = [
    "super_admin",
    "admin",
    "doctor",
    "nurse",
    "content_manager",
    "appointment_manager",
    "finance_manager",
  ];

  it.each(staffRoles)("requires 2FA for staff role: %s", (role) => {
    expect(requires2FA(role)).toBe(true);
  });

  it("does not require 2FA for patient-only 'user' role", () => {
    expect(requires2FA("user")).toBe(false);
  });

  it("does not require 2FA when role is null/undefined (unauthenticated)", () => {
    expect(requires2FA(null)).toBe(false);
    expect(requires2FA(undefined)).toBe(false);
  });

  it("STAFF_ROLES_REQUIRING_2FA matches the list under test (no drift)", () => {
    expect([...STAFF_ROLES_REQUIRING_2FA].sort()).toEqual([...staffRoles].sort());
  });
});
