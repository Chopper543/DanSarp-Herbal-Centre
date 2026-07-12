-- P0 — refund_requests INSERT forgery fix.
--
-- Problem: the refund_requests INSERT policy allowed ANY authenticated user to
-- insert a row as long as requested_by = auth.uid():
--
--   WITH CHECK ((select is_finance_staff_user()) OR requested_by = (select auth.uid()))
--
-- Nothing tied the row to ownership of the referenced payment, and the only
-- column constraints are amount >= 0 plus the tier/status enums. Via the Supabase
-- JS client a patient could forge a pending, tier 'full', full-amount refund
-- request against ANY payment_id — including payments they do not own — bypassing
-- the server-side cancellation policy (evaluateCancellationRefund) that is
-- supposed to be the only thing setting tier/amount.
--
-- What makes the fix safe: there is NO legitimate INSERT path through the
-- user-scoped (RLS-bound) client. The only real inserter is the appointment-
-- cancellation auto-create in app/api/appointments/route.ts, which uses the
-- service-role client (BYPASSRLS) with a server-computed amount/tier. The refunds
-- API (app/api/refunds/route.ts) likewise operates via service-role. So the
-- self-insert branch has no legitimate use — it is pure attack surface.
--
-- Fix: restrict INSERT to finance staff only. Service-role writes (the real
-- creation path) are unaffected because service_role bypasses RLS. The table
-- GRANT is intentionally left as-is (SELECT/INSERT/UPDATE to authenticated); the
-- policy WITH CHECK is the gate, matching the pattern of the other
-- refund_requests policies.

DROP POLICY IF EXISTS refund_requests_insert_admin ON refund_requests;
CREATE POLICY refund_requests_insert_admin ON refund_requests
  FOR INSERT WITH CHECK ((select is_finance_staff_user()));
