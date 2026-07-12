-- P0 defense-in-depth — clinical records cannot be PHYSICALLY deleted, even by
-- RLS-bypassing writers. The DELETE analog of clinical_records_freeze_identity
-- (migration 20260708000001).
--
-- Background (FIXES.md): fix/clinical-notes-soft-delete-id moved the application
-- delete path to a soft-delete (sets deleted_at/deleted_by/deleted_reason; the row
-- is preserved for HIPAA retention). But that is an APP-layer guard only. The RLS
-- DELETE policies `notes_delete_admin` / `lab_delete_admin`
-- (final_schema.sql) still PERMIT a physical DELETE by any admin, and a direct
-- table-owner / service-role writer bypasses RLS entirely — nothing binds a
-- bypassing writer to the retention model. This migration adds the missing
-- BEFORE DELETE backstop so a future handler regression OR any bypassing writer
-- cannot physically destroy a clinical record.
--
-- The one legitimate physical-erasure path is the right-to-be-forgotten cron
-- (app/api/cron/patient-data-deletions/route.ts), which runs on the service-role
-- client. A blanket block would break it. So the erasure path is routed through a
-- gated SECURITY DEFINER RPC, purge_patient_clinical_data(), which sets a
-- transaction-local flag the trigger honours — and ONLY after confirming a
-- pending/processing deletion_requests row exists for the user, so the hatch can be
-- used for genuine erasures and nothing else. A raw supabase-js .delete() cannot set
-- that flag (PostgREST issues one statement per request and cannot smuggle a SET),
-- so the block holds against the bypassing-writer threat surface.
--
-- Scope: clinical_notes + prescriptions. lab_results is DEFERRED — it still has live
-- physical-delete admin API handlers and no soft-delete columns, so it needs the
-- notes-style soft-delete conversion first (its own branch). The purge RPC already
-- erases lab_results (same erasure semantics), it just has no block trigger yet.
--
-- Triggers (not RLS) so the guard also binds table-owner / service-role writers,
-- which bypass RLS but still fire BEFORE triggers.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DELETE guard: block physical deletes unless the purge flag is set.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION clinical_records_block_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM set_config('search_path','public,extensions',true);

  -- The gated legal-erasure path (purge_patient_clinical_data) sets this
  -- transaction-local flag before deleting. Everything else is rejected.
  IF current_setting('app.allow_clinical_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION
    'clinical record cannot be physically deleted: % (record %) is retained; use the soft-delete UPDATE or the gated purge RPC',
    TG_TABLE_NAME, OLD.id
    USING ERRCODE = 'check_violation';
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Gated erasure hatch: the ONLY sanctioned physical-delete path.
--    SECURITY DEFINER so it can set the flag + delete regardless of caller role,
--    but it first proves a real deletion request exists for the user, and it is
--    executable by service_role only.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION purge_patient_clinical_data(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Gate: only purge for a user with a live erasure request. The cron flips the
  -- request to 'processing' before it purges, so accept pending OR processing.
  IF NOT EXISTS (
    SELECT 1 FROM deletion_requests
    WHERE user_id = p_user_id
      AND status IN ('pending','processing')
  ) THEN
    RAISE EXCEPTION
      'purge_patient_clinical_data: no pending/processing deletion_request for user %',
      p_user_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Transaction-local: opens the block trigger for THIS transaction only, then
  -- reverts at commit. A later raw DELETE in the same session is blocked again.
  PERFORM set_config('app.allow_clinical_purge','on', true);

  DELETE FROM clinical_notes WHERE patient_id = p_user_id;
  DELETE FROM prescriptions  WHERE patient_id = p_user_id;
  DELETE FROM lab_results    WHERE patient_id = p_user_id;
END;
$$;

-- Lock the hatch down: no ambient EXECUTE, service_role (the cron) only.
REVOKE ALL ON FUNCTION purge_patient_clinical_data(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION purge_patient_clinical_data(UUID) FROM anon;
REVOKE ALL ON FUNCTION purge_patient_clinical_data(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION purge_patient_clinical_data(UUID) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Wire the triggers (DROP-then-CREATE so the migration is re-runnable).
-- clinical_notes + prescriptions only (lab_results deferred).
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS clinical_notes_block_delete ON clinical_notes;
CREATE TRIGGER clinical_notes_block_delete
  BEFORE DELETE ON clinical_notes
  FOR EACH ROW EXECUTE FUNCTION clinical_records_block_delete();

DROP TRIGGER IF EXISTS prescriptions_block_delete ON prescriptions;
CREATE TRIGGER prescriptions_block_delete
  BEFORE DELETE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION clinical_records_block_delete();
