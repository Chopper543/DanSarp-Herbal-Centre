/**
 * @jest-environment node
 *
 * Drift-prevention test for Row-Level Security.
 *
 * A future migration that adds a new PHI/sensitive table without enabling RLS
 * would be invisible in code review but is the kind of mistake that ends with
 * a data-breach disclosure letter. This test reads the canonical schema and
 * asserts that every table on the locked-down allowlist has both a
 * CREATE TABLE definition and a matching ENABLE ROW LEVEL SECURITY statement.
 *
 * When a new sensitive table is intentionally added, the contributor must add
 * its name here — making "we forgot RLS" a visible, deliberate omission rather
 * than a silent one.
 */

import { readFileSync } from "fs";
import { join } from "path";

const SCHEMA_PATH = join(__dirname, "..", "supabase", "final_schema.sql");

// Tables that hold PHI, PII, payments, audit, or auth/security state. RLS is
// non-negotiable here. Public-by-design tables (treatments, blog_posts, etc.)
// are intentionally excluded — they're still in the schema with RLS enabled,
// but their leakage is not a security incident.
const RLS_REQUIRED_TABLES = [
  // Identity / auth
  "users",
  "profiles",
  "admin_invites",
  // Clinical (PHI)
  "patient_records",
  "clinical_notes",
  "lab_results",
  "prescriptions",
  "prescription_refills",
  "treatment_plans",
  "treatment_plan_followups",
  "intake_forms",
  "intake_form_responses",
  "health_metrics",
  // Operational PHI-adjacent
  "appointments",
  "appointment_waitlist",
  "doctor_availability",
  "messages",
  // Financial
  "payments",
  "payment_ledger",
  // Audit / compliance
  "audit_logs",
  "deletion_requests",
  // Webhook intake (carries provider tokens / PII)
  "webhook_events",
];

describe("RLS coverage — final_schema.sql", () => {
  const schema = readFileSync(SCHEMA_PATH, "utf8");

  it.each(RLS_REQUIRED_TABLES)("table %s has CREATE TABLE definition", (table) => {
    const createRegex = new RegExp(`CREATE TABLE\\s+(IF NOT EXISTS\\s+)?${table}\\b`, "i");
    expect(schema).toMatch(createRegex);
  });

  it.each(RLS_REQUIRED_TABLES)("table %s has ENABLE ROW LEVEL SECURITY", (table) => {
    const rlsRegex = new RegExp(`ALTER TABLE\\s+${table}\\s+ENABLE ROW LEVEL SECURITY`, "i");
    expect(schema).toMatch(rlsRegex);
  });

  it("every sensitive table also has at least one CREATE POLICY", () => {
    // Tables with RLS but zero policies are locked to service_role only —
    // which is sometimes intentional (audit_logs is append-via-RPC), but a
    // brand-new PHI table with this state is almost always a bug. Flag any
    // table on the allowlist that has no policy at all.
    const tablesWithoutPolicy: string[] = [];
    for (const table of RLS_REQUIRED_TABLES) {
      const policyRegex = new RegExp(`CREATE POLICY\\s+[^;]+\\s+ON\\s+(public\\.)?${table}\\b`, "i");
      if (!policyRegex.test(schema)) {
        tablesWithoutPolicy.push(table);
      }
    }
    // audit_logs is intentional: SELECT-for-admin only, INSERT via service_role.
    // It has one SELECT policy, so the regex above still matches. If something
    // ends up here, investigate before adding it to the allowlist.
    expect(tablesWithoutPolicy).toEqual([]);
  });
});
