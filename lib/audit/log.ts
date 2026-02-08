import { createClient } from "@/lib/supabase/server";

interface AuditEvent {
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Writes an audit log entry. Failures are logged but do not throw to avoid
 * blocking primary flows.
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    const supabase = await createClient();
    // @ts-ignore - Supabase type inference issue
    const { error } = await supabase.from("audit_logs").insert({
      user_id: event.userId,
      action: event.action,
      resource_type: event.resourceType,
      resource_id: event.resourceId || null,
      metadata: event.metadata || {},
    });

    if (error) {
      console.error("Audit log insert failed:", error);
    }
  } catch (err) {
    console.error("Audit log error:", err);
  }
}
