-- ============================================================================
-- ADD DOCTOR & NURSE ROLES
-- ============================================================================
-- Adds 'doctor' and 'nurse' to the user_role enum.
-- Uses a safe DO block so the migration is idempotent.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role'
      AND e.enumlabel = 'doctor'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'doctor';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role'
      AND e.enumlabel = 'nurse'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'nurse';
  END IF;
END
$$;

