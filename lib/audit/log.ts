import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/monitoring/logger";

interface AuditEvent {
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  /**
   * Pre/post snapshots written to dedicated `old_data` / `new_data` columns.
   * Pass the row exactly as returned from the DB; callers should NOT pre-diff
   * — readers (admins) need the full before/after to investigate incidents.
   * For creates, omit `oldData`; for deletes, omit `newData`.
   */
  oldData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
  metadata?: Record<string, any>;
  requestInfo?: {
    ip?: string | null;
    userAgent?: string | null;
    path?: string | null;
  };
}

/**
 * Writes an audit log entry.
 *
 * Uses the service-role client deliberately: audit_logs is RLS-locked (no
 * INSERT path for the authenticated/anon roles) so a user-scoped client would
 * be silently rejected. Auditing must never depend on the actor's own
 * permissions.
 *
 * Failures do not throw — we never want a logging outage to take down a PHI
 * read or a payment — but they escalate via `logger.error` (Sentry in prod)
 * rather than a swallowed console line, so a broken audit trail is loud, not
 * silent.
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    const supabase = createServiceClient();
    // @ts-ignore - Supabase type inference issue
    const { error } = await supabase.from("audit_logs").insert({
      user_id: event.userId,
      action: event.action,
      resource_type: event.resourceType,
      resource_id: event.resourceId || null,
      old_data: event.oldData ?? null,
      new_data: event.newData ?? null,
      ip_address: event.requestInfo?.ip || null,
      metadata: {
        ...(event.metadata || {}),
        ...(event.requestInfo
          ? {
              request_user_agent: event.requestInfo.userAgent || null,
              request_path: event.requestInfo.path || null,
            }
          : {}),
      },
    });

    if (error) {
      logger.error("Audit log insert failed", error, {
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
      });
    }
  } catch (err) {
    logger.error("Audit log write threw", err, {
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
    });
  }
}
