### Test Coverage for Safety Rails

- **What to cover**:
  - Validation: PHI endpoints reject invalid payloads (clinical-notes, lab-results, prescriptions, patient-records, storage upload).
  - Security flows: 2FA enforcement in proxy, CSRF rejection on mutating routes, rate-limit errors on PHI endpoints.
  - Audit logging: create/update/delete emits audit_log with IP/UA/path.
  - Payments: idempotent payment creation; rejects raw card data; prerequisite enforcement for booking.
  - Webhooks: signature verification and DLQ behavior (to implement).
- **How**:
  - Add API integration tests in `__tests__` using Next.js request mocks + Supabase test client.
  - Add e2e flows in `e2e/` (Playwright) for booking + payment + clinical note creation with 2FA gate.
  - Use seeded fixtures; run against ephemeral database or mocked Supabase client.
- **Automation**:
  - Run in CI on every PR; include coverage thresholds for API layer.
  - Add smoke tests post-deploy against staging.
