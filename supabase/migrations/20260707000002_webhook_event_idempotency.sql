-- P0 — webhook event idempotency: claim-then-finalize + idempotent appointment.
--
-- Problem (all three webhook handlers): the event was recorded in webhook_events
-- BEFORE payment lookup/processing. Any post-claim failure (payment not found,
-- verify timeout, throw in processing, or the swallowed appointment-creation
-- failure) left the row committed, so the provider's retry saw "duplicate" and
-- returned 200 without ever processing -> customer paid, no appointment, system
-- believes it's done. Separately, appointment auto-creation guarded only on a
-- non-atomic `payment.appointment_id` check, so concurrent/duplicate deliveries
-- could double-book.
--
-- Fix, two parts:
--   1. webhook_events gains a processing lifecycle (status/attempts/lease) so a
--      claim is distinct from a completion. A row is only 'processed' after the
--      full path (incl. appointment) succeeds; a 'failed' row or a 'processing'
--      row whose lease expired is reclaimable, so retries reprocess. attempts is
--      capped (poison events -> 'dead', stop retrying, alert). The acquire step
--      is a single SECURITY DEFINER RPC so insert-or-reclaim is atomic and
--      race-safe. The RPC touches ONLY webhook_events.
--   2. appointments gains payment_id + a partial UNIQUE index, so the DATABASE
--      guarantees at most one appointment per originating payment regardless of
--      timing. This is the real safety net against double-booking; the lease is
--      only an optimization to recover crash-orphaned 'processing' rows.

-- ---------------------------------------------------------------------------
-- 1a. webhook_events processing state
-- ---------------------------------------------------------------------------
ALTER TABLE webhook_events
  ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing','processed','failed','dead')),
  ADD COLUMN IF NOT EXISTS attempts     INT  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_error   TEXT,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Every row that exists today predates this model, where "row exists" meant
-- "already processed". Mark them processed so the fix never reprocesses history.
UPDATE webhook_events
   SET status = 'processed', processed_at = COALESCE(processed_at, received_at)
 WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS webhook_events_status_updated_idx
  ON webhook_events (status, updated_at);

-- ---------------------------------------------------------------------------
-- 1b. Atomic acquire-or-reclaim. Touches ONLY webhook_events.
--   result: 'acquired'            -> caller should process (row is 'processing')
--           'duplicate_processed' -> already done, skip
--           'in_flight'           -> another worker holds a fresh lease, defer (503)
--           'dead'                -> attempts exhausted, skip + alert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION acquire_webhook_event(
  p_provider     TEXT,
  p_event_id     TEXT,
  p_event_type   TEXT,
  p_payload      JSONB,
  p_max_attempts INT,
  p_lease        INTERVAL
) RETURNS TABLE (result TEXT, attempts INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row webhook_events%ROWTYPE;
BEGIN
  -- Fast path: first delivery inserts a fresh 'processing' claim.
  BEGIN
    INSERT INTO webhook_events (provider, event_id, event_type, payload, status, attempts, updated_at)
    VALUES (p_provider, p_event_id, p_event_type, p_payload, 'processing', 1, NOW());
    result := 'acquired'; attempts := 1; RETURN NEXT; RETURN;
  EXCEPTION WHEN unique_violation THEN
    -- Row already exists; fall through to reclaim decision.
  END;

  -- Lock the existing row so concurrent reclaimers serialize here.
  SELECT * INTO v_row FROM webhook_events
    WHERE provider = p_provider AND event_id = p_event_id
    FOR UPDATE;

  IF v_row.status = 'processed' THEN
    result := 'duplicate_processed'; attempts := v_row.attempts; RETURN NEXT; RETURN;
  ELSIF v_row.status = 'dead' THEN
    result := 'dead'; attempts := v_row.attempts; RETURN NEXT; RETURN;
  ELSIF v_row.status = 'processing' AND v_row.updated_at >= NOW() - p_lease THEN
    result := 'in_flight'; attempts := v_row.attempts; RETURN NEXT; RETURN;
  ELSE
    -- status 'failed', OR 'processing' with an expired lease: reclaim or give up.
    IF v_row.attempts >= p_max_attempts THEN
      UPDATE webhook_events SET status = 'dead', updated_at = NOW() WHERE id = v_row.id;
      result := 'dead'; attempts := v_row.attempts; RETURN NEXT; RETURN;
    ELSE
      UPDATE webhook_events
         SET status = 'processing', attempts = v_row.attempts + 1, updated_at = NOW()
       WHERE id = v_row.id;
      result := 'acquired'; attempts := v_row.attempts + 1; RETURN NEXT; RETURN;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION acquire_webhook_event(TEXT, TEXT, TEXT, JSONB, INT, INTERVAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acquire_webhook_event(TEXT, TEXT, TEXT, JSONB, INT, INTERVAL) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Idempotent appointment guard: at most one appointment per payment.
-- ---------------------------------------------------------------------------
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;

-- Partial so normal (non-payment) bookings, payment_id IS NULL, are unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_one_per_payment
  ON appointments (payment_id) WHERE payment_id IS NOT NULL;
