# Smoke-test checklist — prod-readiness changes

Run against **staging** after applying `supabase/final_schema.sql` (the single,
self-contained schema — no separate migrations). Order matters: DB checks first
(prove the audit + refund foundations), then HTTP.

Prereqs:
- `psql` access to the staging DB (`$SUPABASE_DB_URL`)
- `BASE_URL` of the deployed staging app
- A **staff** session cookie/JWT (doctor or admin) and a **patient** session
- `CRON_SECRET` (for cron endpoints)

The HTTP-only checks (1, 6, 7) are automated by `scripts/smoke-test.sh`. The
DB-dependent checks (2–5, 8) are copy-paste SQL below.

---

## ✅ 1. Public health endpoint does not leak internals  *(automated)*
```bash
curl -s "$BASE_URL/api/health" | tee /dev/stderr | grep -qiE "Database error:|Redis error:|stack|at Object" \
  && echo "FAIL: health leaks internals" || echo "PASS: health is generic"
```
Expect: `checks.database`/`checks.redis` present; **no** raw error text.

## ✅ 2. Audit trail actually records a PHI read  *(P0 — the headline fix)*
1. As **staff**, read a patient record you don't own, e.g. `GET /api/clinical-notes?patient_id=<other-patient>`.
2. Then:
```sql
SELECT action, resource_type, user_id, created_at
FROM audit_logs
WHERE action IN ('read_clinical_note','list_clinical_notes')
ORDER BY created_at DESC LIMIT 5;
```
Expect: a fresh row. **Before this PR there would be none** (RLS silently rejected it).

## ✅ 3. `audit_logs` is write-once-read-many (tamper-evident)
As the `authenticated` role (or via the app's anon/JWT path), these must FAIL:
```sql
-- Expect: permission denied / 0 rows affected (RLS + REVOKE)
UPDATE audit_logs SET action = 'tampered' WHERE id = (SELECT id FROM audit_logs LIMIT 1);
DELETE FROM audit_logs WHERE id = (SELECT id FROM audit_logs LIMIT 1);
```

## ✅ 4. PHI mutations hit the DB-level audit trigger
```sql
SELECT COUNT(*) FROM audit_logs WHERE table_name = 'clinical_notes';   -- note the value
```
Create/amend a clinical note via the app, then re-run — the count must increase.
Repeat spot-check for `lab_results`, `prescriptions`, `patient_records`, `intake_form_responses`.

## ✅ 5. Trigger captures the real actor & doesn't roll back writes
Confirm a normal authenticated write to an audited table (e.g. update an appointment)
**succeeds** (no rollback) and the audit row's `user_id` = the acting user:
```sql
SELECT table_name, action, user_id, created_at FROM audit_logs
WHERE table_name = 'appointments' ORDER BY created_at DESC LIMIT 3;
```

## ✅ 6. Error responses are generic, not raw  *(automated, partial)*
```bash
# Unauthenticated admin route -> 401 "Unauthorized", never a DB/stack string
curl -s -o /tmp/r.json -w "%{http_code}\n" "$BASE_URL/api/admin/users"
grep -qiE "constraint|relation|stack|syntax error|supabase" /tmp/r.json \
  && echo "FAIL: leaked internals" || echo "PASS: generic"
```

## ✅ 7. Payment webhooks reject unsigned/forged requests  *(automated)*
```bash
# No signature header -> 401, no DB probing
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/api/webhooks/payments" \
  -H 'content-type: application/json' -d '{"data":{"reference":"x"}}'   # expect 401
```

## ✅ 8. Webhook amount reconciliation holds underpayments  *(manual — needs a signed payload)*
With a **valid Paystack signature** over a `charge.success` body whose verified amount is
LESS than the stored `payments.amount`:
- The payment must stay `pending` (not `completed`), and:
```sql
SELECT status, metadata->>'requires_manual_review' AS review
FROM payments WHERE provider_transaction_id = '<ref>';
```
Expect `status = pending`, `review = true`, and **no** auto-created appointment.

## ✅ 9. Refund pipeline end-to-end
1. **Create:** cancel a paid appointment ≥24h out (`PATCH /api/appointments` action `cancel`).
   ```sql
   SELECT status, tier, amount FROM refund_requests
   WHERE appointment_id = '<appt>' ORDER BY created_at DESC LIMIT 1;   -- pending / full
   ```
2. **Approve:** as finance staff `PATCH /api/refunds {request_id, action:"approve"}` → `approved`.
3. **Process:**
   - Card rail (paystack/flutterwave): `action:"process"` → provider refund → `processed`,
     and `payments.refunded_amount` bumped, ledger `refund` row written.
   - Ghana rails: `process` **without** `payout_reference` → `422`; with it → `processed`.
4. **Double-process guard:** call `process` twice quickly → second returns `409`.
5. **Reject path:** on a different request, `action:"reject"` → `rejected`.
```sql
SELECT id, status, provider_refund_id, failure_reason FROM refund_requests
ORDER BY updated_at DESC LIMIT 5;
SELECT payment_id, transaction_type, amount FROM payment_ledger
WHERE transaction_type = 'refund' ORDER BY created_at DESC LIMIT 5;
```

## ✅ 10. Booking notifications don't block the response
Book an appointment with a (sandbox) email/WhatsApp configured to be slow/unavailable.
The `POST /api/appointments` response should return promptly (201) regardless; a send
failure appears in logs, not in the HTTP response.

---

### Rollback note
The schema is largely idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE` / drop-then-create).
The riskiest piece is the `SECURITY DEFINER` switch on `create_audit_log()` — if audit writes
start failing in logs, confirm
`create_audit_log()` is owned by a `BYPASSRLS` role (`SELECT proowner::regrole, prosecdef
FROM pg_proc WHERE proname = 'create_audit_log';`).
