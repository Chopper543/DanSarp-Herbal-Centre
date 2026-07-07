-- P0 — refund atomicity + no-blind-retry.
--
-- Problem (app/api/refunds/route.ts process path): the provider refund fires
-- (real money moves), then TWO separate DB writes run — payments.refunded_amount,
-- then refund_requests -> 'processed'. If either throws after the provider
-- succeeded, the books split-brain (payment bumped but request 'failed', or
-- vice-versa), and a post-provider failure lands in 'failed' — a state an operator
-- can re-approve and re-run, re-calling the provider (no idempotency key) => double
-- refund.
--
-- Fix:
--   1. finalize_refund RPC: bump payments + mark refund_requests processed in ONE
--      transaction (recompute-under-lock; idempotent). Touches only refund_requests
--      + payments (the payment_ledger trigger fires in the same txn — intended, so
--      the ledger entry is now atomic with the refund).
--   2. A distinct 'needs_reconciliation' status for the case where the provider MAY
--      have moved money but we couldn't record it. The `process` action requires
--      status='approved' to claim, so needs_reconciliation is un-re-runnable by
--      construction — money-may-have-moved can never be blindly retried. 'failed'
--      is reserved for pre-provider failures only (money definitely not moved).
--   3. provider_call_attempted_at marks that a provider call was started BEFORE it
--      fires, so a crash mid-call is detectable (attempted_at set => treat as
--      maybe-moved). idempotency_key is a stable reference for the deferred
--      per-provider getRefund reconciliation (see FIXES.md).

ALTER TABLE refund_requests
  ADD COLUMN IF NOT EXISTS provider_call_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Extend the status domain with needs_reconciliation. The inline column CHECK is
-- named refund_requests_status_check by Postgres convention.
ALTER TABLE refund_requests DROP CONSTRAINT IF EXISTS refund_requests_status_check;
ALTER TABLE refund_requests
  ADD CONSTRAINT refund_requests_status_check
  CHECK (status IN ('pending','approved','processing','rejected','processed','failed','needs_reconciliation'));

-- Atomic finalize. Derives payment_id + amount from the request row (no stale
-- caller totals), locks both rows, idempotent (no-op if already processed).
CREATE OR REPLACE FUNCTION finalize_refund(
  p_request_id         UUID,
  p_provider_refund_id TEXT
) RETURNS refund_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  r          refund_requests%ROWTYPE;
  pay        payments%ROWTYPE;
  new_refund NUMERIC(10,2);
  fully      BOOLEAN;
BEGIN
  SELECT * INTO r FROM refund_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'refund_request % not found', p_request_id;
  END IF;

  -- Idempotent: already finalized.
  IF r.status = 'processed' THEN
    RETURN r;
  END IF;
  IF r.status NOT IN ('processing', 'needs_reconciliation') THEN
    RAISE EXCEPTION 'refund % not finalizable from status %', p_request_id, r.status;
  END IF;

  SELECT * INTO pay FROM payments WHERE id = r.payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment % not found', r.payment_id;
  END IF;

  new_refund := COALESCE(pay.refunded_amount, 0) + r.amount;
  IF new_refund > pay.amount + 0.0001 THEN
    RAISE EXCEPTION 'refund would exceed captured amount (% > %)', new_refund, pay.amount;
  END IF;
  fully := new_refund >= pay.amount - 0.0001;

  UPDATE payments
     SET refunded_amount = new_refund,
         status = CASE WHEN fully THEN 'refunded' ELSE status END,
         updated_at = NOW()
   WHERE id = pay.id;

  UPDATE refund_requests
     SET status = 'processed',
         provider_refund_id = p_provider_refund_id,
         processed_at = NOW(),
         updated_at = NOW()
   WHERE id = p_request_id
  RETURNING * INTO r;

  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION finalize_refund(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_refund(UUID, TEXT) TO service_role;
