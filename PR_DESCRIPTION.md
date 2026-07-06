# Production-readiness hardening: audit integrity, error-leak sweep, payment safety & refund pipeline

## Summary
Hardening pass across the API surface, database audit layer, and payment/refund
flows, plus a new admin refund pipeline. Mostly defense-in-depth on already-solid
foundations — no behavioural changes to the happy path. **56 files changed, ~10 new.**
All DB changes are consolidated into the single, self-contained
`supabase/final_schema.sql` (no separate migrations).

> ⚠️ **Reviewers:** run `npm run type-check` and `npm test` locally — CI verification
> was not possible in the authoring environment. Apply `supabase/final_schema.sql` to a
> scratch/staging DB and run the smoke-test checklist before merge.

---

## ⚠️ UNREVIEWED — needs first review

This is the first time this branch has been on the remote or reviewed, and it is
large. It is organized into **8 feature-scoped commits** (see `git log`) so each area
can be reviewed independently. The following areas have **NOT** had a
security/architecture review and must get one before they can be trusted for a system
handling PHI and payments:

- **Payments / refunds** — only the payment webhook route was reviewed (and passed the
  audit); **refunds, amount-reconciliation, and Ghana-rails provider signatures are UNREVIEWED.**
- **Clinical** — prescriptions and clinical-notes read paths were spot-checked;
  **prescription/vitals validators, treatment-plans, and patient-records are UNREVIEWED.**
- **Notifications / integrations** — email / SMS / WhatsApp / Cloudinary is **entirely UNREVIEWED.**
- **Everything else** — content / SEO / profile routes are **UNREVIEWED** (low PHI exposure, but unlooked-at).

**Reviewed / in scope:** the audit-log integrity work (the branch's original purpose) and
the existing auth / 2FA / CSP / CSRF security layer. Note the known **2FA-bypass fix (B1)
is deliberately NOT in this branch** — it lands separately on `fix/2fa-server-binding`.

---

## What & why

### 1. Audit trail was silently non-functional (P0 — compliance blocker)
`audit_logs` has RLS enabled with only an admin `SELECT` policy and no INSERT path,
but both writers assumed one:
- `logAuditEvent` wrote via the user-scoped (anon-key) client → every insert was
  RLS-rejected and the error swallowed. **PHI access auditing was being lost.**
- `create_audit_log()` was `SECURITY INVOKER` → under an authenticated session its
  insert was also rejected, which could roll back the parent write to audited tables.

**Fix:** writer now uses the service-role client; trigger is `SECURITY DEFINER` with a
pinned `search_path`; `audit_logs` is locked write-once-read-many (REVOKE
INSERT/UPDATE/DELETE from `authenticated`/`anon`); audit-write failures now escalate
via `logger.error` (Sentry) instead of a swallowed `console.error`. Added DB-level
mutation-audit triggers to the PHI tables (`clinical_notes`, `lab_results`,
`prescriptions`, `patient_records`, `intake_form_responses`).

### 2. Internal error messages leaked to clients (P1)
~195 catch blocks / DB-error branches returned raw `error.message` (or
`error.message || "…"`), disclosing DB structure, constraint names, and internals.
Introduced `lib/api/errors.ts` with three helpers covering the catch-block shapes:
- `internalError(context, error, clientMessage?)` — logs detail, returns a safe 500.
- `badRequest(context, error, clientMessage?)` — logs detail, returns a safe 400.
- `authAwareError(context, error, fallback)` — maps `requireAuth`'s
  `Unauthorized`/`Forbidden` throws to 401/403, everything else to a logged generic 500.

Also hardened the public `/api/health` endpoint, which was echoing raw DB/Redis error
text unauthenticated.

### 3. Payment webhook amount reconciliation (P1)
Webhooks re-verify status with the provider but never checked the **amount**. Added
`reconcilePaymentAmount()` (handles Paystack minor-units vs Flutterwave major-units);
on mismatch/underpayment the payment is held at `pending`, flagged
`requires_manual_review`, and a high-severity log fires — so a booking is never
auto-created off an unreconciled payment.

### 4. Booking notifications no longer block the response (P1)
The appointment `POST`/reschedule paths `await`-ed email/WhatsApp sends inline; a slow
provider added latency to (or could fail) the booking. Now fire-and-forget with logged
failures, matching the existing status-update path.

### 5. Refund honesty + full refund pipeline (P2 + feature)
- Ghana-rails `refundPayment` no longer falsely reports `"refunded"` for a manual rail;
  returns `processing` + `manual_action_required`.
- **New refund pipeline:** cancellation auto-creates a `pending` refund_request per the
  existing tier policy; finance staff `approve`/`reject`/`process` via `app/api/refunds`.
  Processing uses an atomic `approved → processing` claim to prevent double-payouts,
  calls the provider (or records a manual payout reference for Ghana rails), settles by
  bumping `payments.refunded_amount` (drives the ledger trigger), and marks
  `processed`/`failed`. Every transition is audited.

### 6. Logging consistency (P3)
Routed stray `console.*` through the structured `logger` in the server IO libs
(`resend`, `twilio`, `vonage`, `cloudinary`) and 7 server routes. Client components
intentionally keep `console`. Documented the Ghana-rails `verifyPayment` no-poll behaviour.

---

## New files
- `lib/api/errors.ts` — shared error-response helpers
- `lib/payments/amount-reconciliation.ts` — webhook amount/currency reconciliation
- `lib/payments/refunds.ts` — pure refund eligibility + settlement logic
- `app/api/refunds/route.ts` — admin refund lifecycle (list / approve / reject / process)
- Tests: `__tests__/audit-log.test.ts`, `payment-amount-reconciliation.test.ts`, `refund-pipeline.test.ts`

## Database setup
All schema changes are consolidated into **`supabase/final_schema.sql`** — a single,
self-contained file. Run it on a fresh database; there are no separate migration steps.
It includes the audit `SECURITY DEFINER` trigger + WORM lockdown, the PHI audit triggers,
the refunds tables/pipeline, and the (previously missing) `payment_ledger` trigger.

**DB note:** `create_audit_log()` must be owned by a `BYPASSRLS` role (e.g. `postgres`)
for `SECURITY DEFINER` to bypass RLS — the default for objects created via the SQL editor.

## Testing
- Unit tests added for the pure logic (audit writer, amount reconciliation, refund
  eligibility/settlement); these type-check clean.
- **Not yet run in CI** — reviewers must run `npm run type-check && npm test`.
- See the smoke-test checklist for staging validation (audit row on PHI read,
  underpaid webhook held pending, cancel→refund lifecycle).

## Out of scope / follow-ups
- Refund **UI** (pipeline is server-only so far)
- Lint-warning ratchet (`--max-warnings`)
- Supabase type regen to drop the `as any` casts on `refund_requests` / `refunded_amount`

## Risk
Low on the happy path (changes are mostly catch-block + audit/observability + new,
isolated refund routes). Main risks are DB-side (the consolidated `final_schema.sql`,
incl. the audit `SECURITY DEFINER` switch and the newly-wired `payment_ledger` trigger)
and the service-role-client audit writes — all covered by the smoke tests.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
