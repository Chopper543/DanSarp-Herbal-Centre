# FIXES.md — Production-Readiness Remediation

Derived from the Senior Architect security audit of the DanSarp Herbal Centre hospital-admin platform.
**Rule of thumb:** one fix = one branch = one PR. Never batch security controls. Write the failing test first where possible.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · effort **S/M/L**

---

## 0. Before writing any code — verify the two unconfirmed findings

The audit flagged these as *not line-by-line verified*. Confirm before building on them.

- [ ] **H2 attribution** — read `create_audit_log()` in `supabase/final_schema.sql` (~line 717–724) and confirm it sets `user_id := auth.uid()`, which is NULL for service-role writes.
- [ ] **M6 webhook dedup** — confirm a `UNIQUE (provider, event_id)` constraint on `webhook_events` actually exists in `supabase/final_schema.sql`. Without it, provider retries double-create appointments.

---

## 0b. RELEASE BLOCKER — production build is broken

- [~] **`next build` fails at "Collecting page data" with `ENOENT: .next/browser/default-stylesheet.css`; confirmed identical on the base branch, so pre-existing and unrelated to any 2FA work. App cannot produce a production build.**
  - Root cause found: `lib/utils/sanitize.ts` imports `isomorphic-dompurify`, which unconditionally `require("jsdom")`s on the server. jsdom's `style-rules.js` helper does `fs.readFileSync(path.resolve(__dirname, "../../browser/default-stylesheet.css"))` at module load time. Webpack bundles it into a single server chunk, so `__dirname` resolves to the chunk's own directory instead of jsdom's real location — the relative path lands on a file Next never copies.
  - Fix in progress on `fix/build-jsdom-tracing` (branched off `main`, not the 2FA stack): mark `isomorphic-dompurify`/`jsdom` as `serverExternalPackages` in `next.config.js` so they're `require()`d from real `node_modules` at runtime instead of bundled. Verified end-to-end: baseline build fails identically, fixed build completes 108/108 pages, prod server serves real pages, sanitizer behavior (XSS stripping) unchanged.

---

## 1. RELEASE BLOCKER — 2FA bypass (do this first, standalone branch)

Branch: `fix/2fa-server-binding`

- [ ] **C1 / B1 — 2FA is fully bypassable via a client-set cookie.** **M**
  - Files: `app/(auth)/login/page.tsx:65,73,111`, `lib/proxy.ts:120-121,168-183`, `app/api/auth/2fa/verify-login/route.ts:161`
  - [ ] Write a failing middleware test: forge `Cookie: twofa_verified=true` on a gated route → assert rejected.
  - [ ] Delete all `document.cookie = "twofa_verified=..."` writes in `login/page.tsx`.
  - [ ] Move verified-state server-side: either Supabase native MFA (`getAuthenticatorAssuranceLevel()` check in `lib/proxy.ts`) **or** an httpOnly + signed cookie set only via `Set-Cookie` from `verify-login`, bound to the session id.
  - [ ] Run test green. Manually confirm devtools cookie forging no longer works.
  - **Gate invariant:** the middleware must never read a value the client can write.

  - [x] **Implemented via Option B** (server-signed, session-bound HMAC cookie; custom TOTP kept).
    New `TWO_FA_SESSION_SECRET` env var (fail-closed). Both `twofa_verified` and
    `twofa_required` client writes removed; gate derives "must do 2FA" from DB and
    "satisfied" only from the HMAC. Tests: `__tests__/security-2fa-cookie-forgery.test.ts`.

### Follow-up (NOT this branch) — Option A: migrate to Supabase native MFA
  - [ ] Replace the custom `otplib` TOTP (encrypted `two_factor_secret` + hashed
    backup codes in `users`) with Supabase Auth MFA and gate on
    `getAuthenticatorAssuranceLevel()` (AAL2) in `lib/proxy.ts`. Stronger posture
    (assurance level lives in the signed JWT, no app-managed proof cookie), but a
    large migration: forces staff re-enrollment and reworks all four 2FA routes +
    backup codes. Track separately from B1.

### Follow-up (NOT this branch) — proxy 2FA gate fails OPEN on Supabase errors
  - [ ] `lib/proxy.ts` wraps the user lookup + 2FA gate in a `try/catch` that
    swallows errors and lets the request proceed. If `getUser()` or the `users`
    enrollment query throws (transient Supabase/network error), an enrolled
    session with no valid proof is NOT gated. **S**
  - Pre-existing (predates the B1 fix). The B1 change removed the forgeable-cookie
    fallback that ran in this path, so it no longer trusts client cookies — but it
    still fails open rather than closed on a DB error.
  - Fix: on a caught error for a non-public route, fail CLOSED (redirect to
    /login, 401 for API) instead of proceeding. Weigh against lockout-on-outage;
    consider a short-lived cache / limited retry so a blip doesn't lock out staff.

---

## 1b. RELEASE BLOCKER — 2FA mechanism blockers, found during B1 runtime verification

Found while manually driving the running app end-to-end to verify the B1 cookie
fix (B1's own cookie/session-binding logic verified clean — see Section 1). These
are separate, pre-existing defects in the 2FA *mechanism itself*: right now no
one can actually enroll in or log in with 2FA at all. Not part of the B1 branch.

- [ ] **otplib v13 API mismatch — every real TOTP verify throws, 2FA enrollment/login is fully broken.** **S**
  - Files: `app/api/auth/2fa/verify/route.ts:83-92`, `app/api/auth/2fa/verify-login/route.ts:97-108`, `app/api/auth/2fa/disable/route.ts:80-89` (same construction in `app/api/auth/2fa/generate/route.ts:67-79`, which doesn't crash only because `toURI()` never touches the crypto plugin).
  - Repro: enroll a user, submit the correct current TOTP code to `POST /api/auth/2fa/verify` → 500 `{"error":"Failed to verify 2FA code"}`. Server log: `CryptoPluginMissingError: Crypto plugin is required` at `verify/route.ts:92`.
  - Cause: `new TOTP({secret, createDigest, createRandomBytes})` is the otplib-v12 plugin shape (matches the still-present `@otplib/plugin-crypto-js@12.0.1` dependency); the installed `otplib@13.1.1` `TOTP` class requires a `crypto`/`base32` plugin object (`.hmac()`, `.randomBytes()`, `.constantTimeEqual()`), not raw functions. Confirmed against `package-lock.json`'s locked version (13.1.1) — not an install artifact.

- [ ] **RLS gap — non-admin staff can never persist a 2FA secret, permanently stuck at `/setup-2fa`.** **S–M**
  - File: `supabase/final_schema.sql:866` — `CREATE POLICY users_update_admin ON users FOR UPDATE USING ((select is_super_admin_or_admin()));`. No self-update policy exists for a user's own row.
  - Repro: as a `doctor`-role user, call `POST /api/auth/2fa/generate` → 200 with a QR code, but a direct DB read immediately after shows `two_factor_secret IS NULL` (RLS silently drops the update; the route doesn't `.select()` so no error surfaces to the caller or logs). The identical call as `admin` role persists correctly.
  - Effect: combined with `proxy.ts`'s `mustEnroll` gate, every staff role in `STAFF_ROLES_REQUIRING_2FA` other than `super_admin`/`admin` (doctor, nurse, content_manager, appointment_manager, finance_manager) redirects to `/setup-2fa` and can never complete it.

- Minor, noted during the same pass (not blockers):
  - `.env.local` has a placeholder `UPSTASH_REDIS_REST_URL=your_upstash_redis_rest_url`; `/api/health` logs a connection error for it (still returns 200 — optional var). Swap for a real value or unset before deploy.
  - 4 disposable Supabase test accounts created during B1 verification (`verify-2fa-test-*@example.invalid`) were deleted from both `auth.users` and `public.users`; confirmed zero remaining via `listUsers()` + a table scan.

---

## 2. AUDIT INTEGRITY CLUSTER (on the existing `fix/audit-log-integrity` branch)

Do in order — each builds on the last.

- [ ] **H1 / B2 — Role-change audit write silently dropped.** **S**
  - `app/api/admin/admins/route.ts:112-122` inserts to `audit_logs` with the *user-scoped* client, which RLS forbids (`final_schema.sql:917` REVOKE INSERT). Error is unchecked.
  - Fix: route the write through `logAuditEvent()` (service-role, error-escalating) in `lib/audit/log.ts`. Grep for any other raw `from("audit_logs").insert` on a user-scoped client and fix those too.

- [ ] **H2 / B3 — Service-role writes log `user_id = NULL` (no actor).** **M**
  - `create_audit_log()` at `final_schema.sql:717-724` uses `auth.uid()`, NULL under service role. Affects invite-accept role escalation (`lib/auth/invite.ts:114`), webhook payment mutations, deletions.
  - Fix: set a transaction-local `app.actor_id` via `set_config(...)` before service-role mutations and have `create_audit_log` prefer it over `auth.uid()`; and/or emit an explicit `logAuditEvent` with the real actor/source (e.g. `"webhook:paystack"`, `"invite_accept"`).

- [ ] **H3 — PHI reads not logged on single-record routes.** **S–M**
  - Missing on `app/api/clinical-notes/[id]/route.ts` (GET), `app/api/lab-results/[id]/route.ts` (GET), `app/api/intake-forms/[id]/route.ts`, `app/api/intake-forms/[id]/responses/route.ts`.
  - Pattern to copy: `app/api/prescriptions/route.ts:158`.
  - Fix: add `logAuditEvent({action:"read_*", ...})` to every PHI GET. Build a `withPhiRead()` wrapper so it can't be forgotten.

- [ ] **M4 — Invite create/revoke/accept not explicitly audited.** **S**
  - `app/api/admin/invites/route.ts` (POST/DELETE), `app/api/admin/invite/accept/route.ts`.
  - Fix: add explicit `logAuditEvent` with inviter/acceptee identities on create, revoke, accept.

---

## 3. RELEASE BLOCKER — non-transactional deletion (standalone branch)

Branch: `fix/transactional-patient-deletion`

- [ ] **H4 / B4 — GDPR/erasure deletion is 13 parallel deletes, no atomicity.** **M**
  - `app/api/cron/patient-data-deletions/route.ts:40-52`
  - Fix: move the cascade into one Postgres `SECURITY DEFINER` function called via `supabase.rpc(...)` so it's a single transaction. On failure, roll back and mark the request `failed` for retry. Respect FK order or rely on `ON DELETE CASCADE`.

---

## 4. HIGH — auth rate-limit hardening (standalone branch)

- [ ] **H5 — 2FA rate-limit identifier is client-spoofable.** **S**
  - `lib/security/rate-limit-identifier.ts:5-11`, used by `app/api/auth/2fa/verify-login/route.ts:23`. Reads leftmost `x-forwarded-for` (attacker-controlled).
  - Fix: use the session user id for authenticated flows; use the platform-trusted client IP (not raw leftmost XFF) for pre-auth flows. Add a per-account attempt counter with lockout.

---

## 5. MEDIUM

- [ ] **M1 — Admin data console: unlogged, unbounded PHI browsing.** **S** — `app/api/admin/database/route.ts:63-80`. Allowlist browsable tables; audit-log every browse with table + row count.
- [ ] **M2 — Dead SQL console shipped as a feature (returns 501).** **S** — `app/api/admin/database/route.ts:91-142`. *Decision needed:* remove the UI affordance, or implement against a read-only RPC with a hard row cap.
- [ ] **M3 — Doctors/nurses can't be invited.** **S** — `app/api/admin/invites/route.ts:88`. *Decision needed:* add `doctor`/`nurse` to the invite allowlist + accept flow, or document the intended clinician provisioning path.
- [ ] **M5 — In-memory rate-limit fallback is per-instance.** **S** — `lib/rate-limit.ts:45-84`. Keep the prod assertion; ensure preview deployments handling real data also require Upstash.
- [ ] **M6 — Webhook idempotency depends on an unverified unique constraint.** **S** — confirm the `webhook_events` unique constraint exists in the migration + add a test. (See section 0.)

---

## 5b. HARDENING — replace isomorphic-dompurify/jsdom with a lighter sanitizer (standalone branch, not urgent)

- [ ] **Shed the full-DOM dependency and its server attack surface.** **M**
  - `lib/utils/sanitize.ts` uses `isomorphic-dompurify`, which drags a full jsdom DOM implementation onto the server just to sanitize strings (see the build-tracing issue this caused, section 0b). A DOM emulation library is a large, security-sensitive dependency to run server-side for this.
  - Fix: swap for a lighter server-only sanitizer (e.g. `sanitize-html`) with no DOM emulation. Re-express the current `ALLOWED_TAGS`/`ALLOWED_ATTR`/`ALLOWED_URI_REGEXP` config in the new library's terms.
  - This is real PHI/XSS-sensitive work, not a drop-in swap: needs real XSS-payload testing (script injection, attribute injection, malformed/nested tags, dangerous URI schemes) across all 9 call sites — `app/api/{messages,clinical-notes,clinical-notes/[id],appointments,intake-forms/responses,availability,lab-results,lab-results/[id],prescriptions}/route.ts` and `app/(public)/blog/[slug]/page.tsx`. Track and test on its own branch; do not batch with the build-tracing fix (section 0b) or the 2FA work.

---

## 5c. HARDENING — webhook processing as a single transactional RPC (option c, future)

- [ ] **Ideal end-state for webhook idempotency, deferred as too heavy for the P0 fix.** **L**
  - The P0 fix (`fix/webhook-event-idempotency`, migration `20260707000002`) uses claim-then-finalize: `acquire_webhook_event` RPC (status/attempts/lease) + an idempotent `ensureAppointmentForCompletedPayment` guarded by a partial UNIQUE index. Correctness rests on the mark-processed-only-after-full-success ordering plus that DB guard.
  - The strictly-more-correct design is **option (c)**: do the external `verifyPayment` first (read-only, idempotent), then perform the claim + payment update + appointment insert in ONE Postgres transaction via a `SECURITY DEFINER` RPC. Any failure rolls back the claim too, so a retry always reprocesses, and the `UNIQUE(provider,event_id)` serializes concurrent duplicates at commit with zero double-processing — no lease, no attempts bookkeeping needed.
  - Why deferred: the Supabase JS client can't run multi-statement transactions across `.from()` calls, so this requires porting the payment/appointment write path (reconcile, status transition, appointment create/link) into PL/pgSQL — a large, high-risk rewrite of money-movement logic. Disproportionate for the immediate blocker; revisit as a dedicated hardening branch.

## 5d. VERIFY — assumptions the webhook idempotency fix rests on (follow-up, not blockers)

Two external-behaviour assumptions introduced by `fix/webhook-event-idempotency`. Both are correct-by-design internally; they need confirmation against things OUTSIDE this repo.

- [ ] **Webhook HTTP status codes changed — confirm nothing downstream keys on the old ones.** **S**
  - The webhook endpoints now return: payment-not-found `404 → 503`; provider mismatch `401 → 409` (Paystack/FW) and `400 → 409` (ghana-rails); plus new `dead → 200` and `in_flight → 503`. Verify no monitoring/alerting rule, provider dashboard retry config, uptime check, or external/integration test asserts on the previous codes. Internal tests are updated; this is about anything we don't control.
- [ ] **`in_flight → 503` assumes providers RETRY on 503.** **S**
  - A concurrent duplicate that hits a fresh lease is deferred with `503`, relying on the provider re-delivering later (by which point the event is `processed`→skip or reclaimable→reprocess). Verify against **Paystack / Flutterwave / Ghana-rails** webhook retry docs that `503` is treated as retryable, not terminal. If any provider treats `503` (or `5xx`) as a terminal "give up" signal, an in-flight collision would DROP rather than defer — in that case switch that provider's in_flight response to a 2xx-with-retry-hint or a code it does re-deliver on. (Low likelihood — most treat any non-2xx as retryable — but it's the one place the fix depends on provider behaviour.)

---

## 5e. HARDENING — refund reconciliation + second-layer idempotency (deferred from the atomicity fix)

Two follow-ups deliberately deferred from `fix/refund-atomic-finalize` (which made the local writes atomic via `finalize_refund` and routes maybe-money-moved failures to `needs_reconciliation`, never `failed`). Neither is a blocker — the fix's guarantee is "every failure lands detectable and un-re-runnable," and it achieves that without these.

- [ ] **Per-provider `getRefund` reconciliation query + verified Paystack `Idempotency-Key`.** **M**
  - The residual window (accepted): provider refund succeeds, then the process crashes before `finalize_refund` records it → row is `needs_reconciliation` (or `processing` with `provider_call_attempted_at` set), which is safe (never auto-re-refunds) but resolved **manually** today, because there is no way to ask the provider "did this refund actually happen?". Build a `getRefund`/`listRefunds` query per provider (Paystack `GET /refund`, Flutterwave equivalent) keyed on `idempotency_key`/`provider_transaction_id`, and a reconciliation action/job that finalizes or clears a `needs_reconciliation` row from the provider's truth.
  - Bundle the **verified** Paystack `Idempotency-Key` header here (as a *second* layer, not the primary guard): only after confirming from Paystack docs that `/refund` honours it. Deferred precisely because an *unverified* key is false confidence. Flutterwave has no documented key — reconciliation is its only recourse.
- [ ] **Optional lease-sweep for stuck `processing` refunds.** **S**
  - A crash between the intent write and finalize leaves a row `processing` with `provider_call_attempted_at` set. It is un-re-runnable (the `process` claim requires `approved`) and detectable (`WHERE status='processing' AND provider_call_attempted_at IS NOT NULL AND updated_at < now() - <lease>`), but nothing auto-transitions it. Add a small sweep (cron) that flips such stale rows to `needs_reconciliation` so they surface in the normal reconciliation queue instead of relying on an ad-hoc query. (`attempted_at IS NULL` stays safe-to-reclaim — provider was never called.)

---

## 5f. HARDENING — clinical record immutable-field defense-in-depth (deferred from the allowlist fix)

`fix/clinical-patient-id-immutable` made the three clinical PUT/amendment handlers allowlist mutable fields, so `patient_id`/`appointment_id` (and `doctor_id`, note `is_template`/`template_id`/`note_type`, prescription `refills_original`) can no longer be reassigned via a general edit. Two defense-in-depth layers were deliberately deferred.

- [x] **DB-layer immutable-identity backstop — ADDRESSED by `fix/clinical-immutable-db-trigger`.** **M**
  - Q4 of the investigation proved the gap: the clinical UPDATE policies are `FOR UPDATE USING (auth.uid()=doctor_id OR is_*_staff_user())` with **no `WITH CHECK`** (`final_schema.sql:957,983,989`), so RLS gates *who* edits but never *which patient* the row lands on — a `patient_id` reassignment was NOT caught at the DB layer (reproduced against real RLS in `__tests__/security-clinical-patient-immutable.dbtest.ts`). Fixed with a trigger-based backstop (migration `20260708000001_clinical_immutability_triggers.sql`, synced into `final_schema.sql`): `clinical_records_freeze_identity()` `BEFORE UPDATE` on prescriptions/lab_results/clinical_notes rejects any `patient_id`/`appointment_id`/`doctor_id` change (`OLD.x IS DISTINCT FROM NEW.x`); `clinical_notes_amendment_identity()` `BEFORE INSERT` requires an amendment (`amended_from_id` set) to inherit its parent's identity. Chosen over `WITH CHECK` because a trigger also binds table-owner / direct service-role writers that bypass RLS. Proven by `__tests__/security-clinical-immutable-trigger.dbtest.ts` on the RLS-bypassing owner connection, including an invisible-to-legit-writes suite (allowlist edit, soft-delete, supersede, refill decrement, matching re-pin all pass). The app allowlist was also extended to the two `/[id]` PUT handlers that 908331f missed (`lab-results/[id]`, `clinical-notes/[id]` — see `__tests__/security-clinical-id-route.test.ts`).
- [x] **`clinical-notes/[id]` PUT updated in place instead of appending an amendment version — RESOLVED (dead path removed).** **M**
  - The append-only amendment model (Phase 3, `final_schema.sql:1561`) says an edit should INSERT a new version (`amended_from_id`→parent, bump `version`, set the parent's `superseded_by_id`) and preserve the old row verbatim for the HIPAA amendment audit trail. The collection route (`clinical-notes/route.ts` PUT) does this; `clinical-notes/[id]/route.ts` PUT did a plain in-place `UPDATE` that silently overwrote prior note content with no version history. Investigation (Q3) confirmed **no caller** hit `PUT /api/clinical-notes/[id]` — every note edit in the UI goes through the collection amendment path (`admin/clinical-notes/page.tsx:51-55`, `admin/clinical-notes/[id]/page.tsx:45-48`, both `PUT /api/clinical-notes` with `id` in the body). Chosen fix: option (c) — **remove the dead `/[id]` PUT handler** (kept `GET`; `DELETE` untouched — see the HIGH item below). Collapses editing to the single append-only path, no drift, no schema change. Identity on any amendment INSERT remains backstopped by `clinical_notes_amendment_identity` from `fix/clinical-immutable-db-trigger`. Coverage: DB-layer freeze in `__tests__/security-clinical-immutable-trigger.dbtest.ts`; the shared `__tests__/security-clinical-id-route.test.ts` keeps the `lab-results/[id]` PUT allowlist assertions (that route is live) and drops the removed clinical-notes half.
- [ ] **HIGH — `clinical-notes/[id]` DELETE HARD-deletes a clinical record, and it is the path the admin UI calls.** **H**
  - `clinical-notes/[id]/route.ts` DELETE does a physical `supabase.from("clinical_notes").delete().eq("id", id)` (`:85` post-removal), and the admin list UI calls exactly this (`admin/clinical-notes/page.tsx:81-82`, `method: "DELETE"` to `/api/clinical-notes/${id}`). Meanwhile the **soft-delete** collection DELETE (`clinical-notes/route.ts:500-511`, sets `deleted_at`/`deleted_by`/`deleted_reason` for retention) has **no caller**. Net effect: admin "delete note" **permanently destroys** a clinical record, bypassing the HIPAA retention / soft-delete model the schema was built for. This is a LIVE data-destruction bug, not a dead path. Needs its own investigation + fix: is soft-delete the correct semantics for the `/[id]` route (almost certainly yes), and does the admin UI wiring stay on `/[id]` (now soft) or move to the collection DELETE? Until fixed, admin deletes are irreversible.
- [ ] **MEDIUM — non-atomic supersede in the collection amendment path.** **M**
  - `clinical-notes/route.ts` PUT INSERTs the new version (`:406-410`) and then, as a **separate** statement, UPDATEs the parent's `superseded_by_id` (`:421-428`). A failure between the two leaves two "live" (non-superseded) rows in the chain — the code comment (`:417-420`) acknowledges this and defers to manual reconciliation. supabase-js can't span the two writes in one transaction across `.from()` calls. Fix is option (b2): an `amend_clinical_note` RPC (SECURITY DEFINER PL/pgSQL) doing the INSERT + parent supersede in a single transaction, called by the collection PUT. Not urgent — the amendment (the medically meaningful event) always persists; only the parent's superseded flag can lag.
- [ ] **Remove the editable patient field from the three edit forms.** **S**
  - `PrescriptionBuilder.tsx:159`, `LabResultForm.tsx:184`, `SOAPNoteEditor.tsx` keep the patient selector editable on the EDIT screen (a create-time affordance left on). The handler now ignores a changed `patient_id`, but the UI still lets a user *think* they can re-file a record under another patient (and silently sends the unchanged id). Disable/lock the patient field when editing an existing record. Purely UX/defense-in-depth — the security hole is already closed server-side.

---

## 6. LOW / Housekeeping

- [ ] **L1** — Delete working-tree artifacts `all-fixes.patch` and `.env.local.bak.*` from repo root.
- [ ] **L2** — Document the `proxy.ts` middleware indirection; the whole security envelope depends on that matcher.
- [ ] **L3** — Replace pervasive `@ts-ignore` on Supabase calls with generated `Database` types.
- [ ] **L4** — Burn down the 730 tolerated ESLint warnings; ratchet `--max-warnings` toward 0.
- [ ] **L5** — `phi-read-audit.test.ts` declares a global `getUserRoleMock` without module scope → cold `tsc --noEmit` reports TS2451 (redeclare). Masked in-session by the `tsconfig.tsbuildinfo` incremental cache; will surface as a CI red once Actions billing is unlocked and a cold build runs. Fix: add `export {}` to that test (own housekeeping branch, not a fix branch).

---

## Suggested landing order

1. Section 1 (2FA) — single most important.
2. Section 2 (audit integrity cluster) — on-theme for the current branch.
3. Section 3 (transactional deletion).
4. Section 4 (H5), then Section 5 (Medium), then Section 6 (housekeeping).

## Verified-solid (do not touch)

Payment webhook signature/idempotency/reconciliation · error-response redaction · RBAC/IDOR scoping on the routes read · central CSRF + size + CSP-nonce enforcement in `lib/proxy.ts`.
