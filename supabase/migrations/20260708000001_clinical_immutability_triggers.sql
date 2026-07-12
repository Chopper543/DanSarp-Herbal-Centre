-- P0 defense-in-depth — clinical record identity is immutable at the DB layer.
--
-- Background (FIXES.md §5f): 908331f made the three clinical PUT/amendment handlers
-- allowlist mutable fields, so a general edit can no longer reassign
-- patient_id/appointment_id/doctor_id. But that is an APP-layer guard only. The
-- clinical UPDATE RLS policies are `FOR UPDATE USING (...)` with NO `WITH CHECK`
-- (final_schema.sql), so RLS gates WHO edits but never WHICH patient the row lands
-- on — a re-targeting UPDATE is not caught at the DB layer, and a direct
-- service-role write (RLS-bypassing) has no guard at all. This migration adds the
-- missing backstop so a future handler regression OR any bypassing writer cannot
-- silently re-file a clinical record under another patient/encounter/clinician.
--
-- Two guards:
--   1. clinical_records_freeze_identity() — BEFORE UPDATE on prescriptions,
--      lab_results, clinical_notes. Rejects ANY change to patient_id /
--      appointment_id / doctor_id (`OLD.x IS DISTINCT FROM NEW.x`, so NULL->value
--      is rejected too). Every other column stays freely mutable — soft-delete,
--      supersede, refill decrement, and the 908331f allowlist edits all pass
--      untouched (they never touch the three frozen columns).
--   2. clinical_notes_amendment_identity() — BEFORE INSERT on clinical_notes. The
--      append-only amendment model (Phase 3) inserts a new row pointing at its
--      parent via amended_from_id; a create-INSERT has amended_from_id = NULL. When
--      amended_from_id IS NOT NULL, the new row's identity MUST equal the parent's
--      — otherwise an amendment could attribute a note to a different patient than
--      the note it claims to amend. Create-INSERTs (amended_from_id NULL) are free.
--
-- Triggers (not RLS) so the guard also binds table-owner / service-role writers,
-- which bypass RLS but still fire BEFORE triggers.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. UPDATE guard: freeze identity columns on all three clinical tables.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION clinical_records_freeze_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM set_config('search_path','public,extensions',true);

  IF NEW.patient_id IS DISTINCT FROM OLD.patient_id THEN
    RAISE EXCEPTION
      'clinical record identity is immutable: patient_id cannot be changed on % (record %)',
      TG_TABLE_NAME, OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.appointment_id IS DISTINCT FROM OLD.appointment_id THEN
    RAISE EXCEPTION
      'clinical record identity is immutable: appointment_id cannot be changed on % (record %)',
      TG_TABLE_NAME, OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.doctor_id IS DISTINCT FROM OLD.doctor_id THEN
    RAISE EXCEPTION
      'clinical record identity is immutable: doctor_id cannot be changed on % (record %)',
      TG_TABLE_NAME, OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. INSERT guard: an amendment's identity must match the note it amends.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION clinical_notes_amendment_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_patient_id     UUID;
  v_appointment_id UUID;
  v_doctor_id      UUID;
BEGIN
  PERFORM set_config('search_path','public,extensions',true);

  -- A create-INSERT (no parent) establishes identity freely.
  IF NEW.amended_from_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT patient_id, appointment_id, doctor_id
    INTO v_patient_id, v_appointment_id, v_doctor_id
    FROM clinical_notes
    WHERE id = NEW.amended_from_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'clinical note amendment references a non-existent parent note %',
      NEW.amended_from_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.patient_id IS DISTINCT FROM v_patient_id
     OR NEW.appointment_id IS DISTINCT FROM v_appointment_id
     OR NEW.doctor_id IS DISTINCT FROM v_doctor_id THEN
    RAISE EXCEPTION
      'clinical note amendment identity must match parent note % (patient_id/appointment_id/doctor_id)',
      NEW.amended_from_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Wire the triggers (DROP-then-CREATE so the migration is re-runnable).
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS prescriptions_freeze_identity ON prescriptions;
CREATE TRIGGER prescriptions_freeze_identity
  BEFORE UPDATE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION clinical_records_freeze_identity();

DROP TRIGGER IF EXISTS lab_results_freeze_identity ON lab_results;
CREATE TRIGGER lab_results_freeze_identity
  BEFORE UPDATE ON lab_results
  FOR EACH ROW EXECUTE FUNCTION clinical_records_freeze_identity();

DROP TRIGGER IF EXISTS clinical_notes_freeze_identity ON clinical_notes;
CREATE TRIGGER clinical_notes_freeze_identity
  BEFORE UPDATE ON clinical_notes
  FOR EACH ROW EXECUTE FUNCTION clinical_records_freeze_identity();

DROP TRIGGER IF EXISTS clinical_notes_amendment_identity ON clinical_notes;
CREATE TRIGGER clinical_notes_amendment_identity
  BEFORE INSERT ON clinical_notes
  FOR EACH ROW EXECUTE FUNCTION clinical_notes_amendment_identity();
