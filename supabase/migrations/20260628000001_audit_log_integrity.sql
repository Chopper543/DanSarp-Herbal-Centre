-- P0 — Audit-log integrity fix.
--
-- Problem: `audit_logs` has RLS enabled with only an admin SELECT policy and no
-- INSERT path for non-privileged roles. Two write paths both broke against it:
--
--   1. App-level `logAuditEvent` wrote via the user-scoped (anon-key) client, so
--      RLS rejected every insert. The application swallowed the error, so PHI
--      read/access auditing was silently lost.
--   2. The `create_audit_log()` trigger was SECURITY INVOKER, so when an audited
--      mutation ran under an authenticated session the trigger's insert was also
--      RLS-rejected — raising inside the trigger and rolling back the parent write.
--
-- Fix:
--   * Make `create_audit_log()` SECURITY DEFINER with a pinned search_path so the
--     trigger always records, regardless of the invoking role, and can never be
--     hijacked via a mutable search_path.
--   * Application writes now go through the service-role client (see
--     lib/audit/log.ts), which bypasses RLS by design.
--   * Lock the table down to write-once-read-many (WORM): no UPDATE/DELETE for
--     anyone reachable through PostgREST, so the trail is tamper-evident. SELECT
--     stays admin-only via the existing policy.
--
-- `auth.uid()` still resolves the real caller inside a SECURITY DEFINER function
-- because the JWT claim is a transaction GUC, not tied to the executing role.

CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  action_type TEXT;
  old_data JSONB;
  new_data JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_type := 'create';
    new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    action_type := 'update';
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    action_type := 'delete';
    old_data := to_jsonb(OLD);
  END IF;

  INSERT INTO audit_logs (
    table_name, record_id, action, old_data, new_data, user_id, created_at, resource_type, resource_id
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    action_type,
    old_data,
    new_data,
    (select auth.uid()),
    NOW(),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Immutability / WORM. RLS already denies inserts to authenticated/anon (no
-- INSERT policy, intentionally). Revoking direct write privileges is belt-and
-- -suspenders and, crucially, removes UPDATE/DELETE so audit rows can never be
-- altered or erased through the API surface. The SECURITY DEFINER trigger and
-- the service-role client are unaffected (definer runs as the function owner;
-- service_role bypasses RLS).
REVOKE INSERT, UPDATE, DELETE ON audit_logs FROM authenticated, anon;

-- There are deliberately NO update/delete policies on audit_logs.
