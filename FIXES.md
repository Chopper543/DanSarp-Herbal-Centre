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

## 1. RELEASE BLOCKER — 2FA bypass (do this first, standalone branch)

Branch: `fix/2fa-server-binding`

- [ ] **C1 / B1 — 2FA is fully bypassable via a client-set cookie.** **M**
  - Files: `app/(auth)/login/page.tsx:65,73,111`, `lib/proxy.ts:120-121,168-183`, `app/api/auth/2fa/verify-login/route.ts:161`
  - [ ] Write a failing middleware test: forge `Cookie: twofa_verified=true` on a gated route → assert rejected.
  - [ ] Delete all `document.cookie = "twofa_verified=..."` writes in `login/page.tsx`.
  - [ ] Move verified-state server-side: either Supabase native MFA (`getAuthenticatorAssuranceLevel()` check in `lib/proxy.ts`) **or** an httpOnly + signed cookie set only via `Set-Cookie` from `verify-login`, bound to the session id.
  - [ ] Run test green. Manually confirm devtools cookie forging no longer works.
  - **Gate invariant:** the middleware must never read a value the client can write.

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

## 6. LOW / Housekeeping

- [ ] **L1** — Delete working-tree artifacts `all-fixes.patch` and `.env.local.bak.*` from repo root.
- [ ] **L2** — Document the `proxy.ts` middleware indirection; the whole security envelope depends on that matcher.
- [ ] **L3** — Replace pervasive `@ts-ignore` on Supabase calls with generated `Database` types.
- [ ] **L4** — Burn down the 730 tolerated ESLint warnings; ratchet `--max-warnings` toward 0.

---

## Suggested landing order

1. Section 1 (2FA) — single most important.
2. Section 2 (audit integrity cluster) — on-theme for the current branch.
3. Section 3 (transactional deletion).
4. Section 4 (H5), then Section 5 (Medium), then Section 6 (housekeeping).

## Verified-solid (do not touch)

Payment webhook signature/idempotency/reconciliation · error-response redaction · RBAC/IDOR scoping on the routes read · central CSRF + size + CSP-nonce enforcement in `lib/proxy.ts`.
