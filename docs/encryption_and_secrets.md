### Encryption & Secret Hygiene

- **Data at rest**:
  - Use Supabase encryption at rest; confirm for storage buckets.
  - For highly sensitive fields (`clinical_notes.subjective/objective/assessment/plan`, `lab_results.results`, `patient_records.medical_history/doctor_notes`), add field-level encryption using a KMS-managed key (AWS KMS or GCP KMS). Store key IDs in env: `PHI_FIELD_KMS_KEY_ID`.
  - Implement envelope encryption helper in `lib/security/crypto.ts` and apply before insert/update; decrypt only for authorized roles.
- **In transit**:
  - Enforce HTTPS/TLS 1.2+. Disable plaintext webhooks; verify webhook signatures.
- **Secrets management**:
  - Source all secrets from environment; no defaults. Key rotation policy: every 90 days or after incident.
  - Inventory secrets: Paystack/Flutterwave/GhanaRails keys, Supabase anon/service keys, Upstash Redis, Sentry DSN, email/Twilio credentials.
  - Use `runtime-env-validation.js` to enforce required secrets; add new keys for encryption helpers.
- **Token handling**:
  - Avoid storing raw access tokens in logs; redact before logging.
  - Rotate service role key if exposed; invalidate sessions via GoTrue.
- **Actions to implement**:
  - Add encryption helpers and wrap PHI writes (notes, lab results, patient records) with encrypt/decrypt.
  - Add secret rotation playbook and automation hook in CI to check secret age.
