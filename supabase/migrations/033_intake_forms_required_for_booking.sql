-- ============================================================================
-- INTAKE FORMS: REQUIRED BEFORE BOOKING FLAG
-- ============================================================================
-- Adds a boolean flag to mark certain intake forms as mandatory before a
-- patient can proceed to appointment booking/payment.
-- ============================================================================

ALTER TABLE intake_forms
  ADD COLUMN IF NOT EXISTS required_for_booking BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_intake_forms_required_for_booking
  ON intake_forms(required_for_booking)
  WHERE required_for_booking = TRUE;

