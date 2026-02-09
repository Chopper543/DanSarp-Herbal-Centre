### Backup Verification & Disaster Recovery

- **Backups**:
  - Daily full database backups; retain 30 days. Weekly backups retained 1 year.
  - Storage bucket snapshots weekly; retain 90 days.
  - All backups encrypted; restrict access to DR role.
- **Verification** (to automate in CI/cron):
  - Nightly restore test into isolated database; run checksum on critical tables (clinical_notes, lab_results, prescriptions, patient_records, audit_logs).
  - Validate RLS policies are present after restore.
  - Smoke test API endpoints against restored database (read-only).
- **Recovery objectives**:
  - RPO: ≤ 15 minutes for database (via point-in-time restore if enabled), ≤ 24 hours for storage.
  - RTO: ≤ 4 hours for primary region; ≤ 12 hours for cross-region failover.
- **Runbook**:
  - Trigger restore from latest healthy backup; rotate Supabase keys post-restore.
  - Rebuild search indexes and re-run migrations; verify audit_logs continuity.
  - Re-enable cron jobs and webhooks after validation.
- **Monitoring**:
  - Alert if backup job fails or size drops unexpectedly (>20% delta).
  - Report weekly verification results to engineering + compliance.
