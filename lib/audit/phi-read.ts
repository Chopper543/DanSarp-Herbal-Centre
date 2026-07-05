import type { NextRequest } from "next/server";
import { logAuditEvent } from "@/lib/audit/log";

/**
 * Builds the `requestInfo` block (IP / user-agent / path) for an audit event
 * from a NextRequest. Mirrors the inline helper used by the prescriptions
 * route so PHI-read logging is uniform across handlers.
 */
export function auditRequestInfo(request: NextRequest) {
  return {
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      null,
    userAgent: request.headers.get("user-agent"),
    path: request.nextUrl?.pathname ?? new URL(request.url).pathname,
  };
}

/**
 * Records a read of protected health information (PHI).
 *
 * HIPAA §164.312(b) expects access (read) logging of ePHI, but the database
 * audit triggers only fire on INSERT/UPDATE/DELETE — reads leave no trace
 * unless the application logs them. Call this from every PHI GET handler once
 * the caller has passed the authorization check, so we only log successful
 * accesses.
 *
 * Delegates to `logAuditEvent`, which uses the service-role client (audit_logs
 * is RLS-locked) and never throws, so a logging hiccup can't take down a PHI
 * read.
 */
export async function logPhiRead(params: {
  request: NextRequest;
  userId: string;
  resourceType: string;
  resourceId: string;
  patientId?: string | null;
  metadata?: Record<string, any>;
}): Promise<void> {
  const { request, userId, resourceType, resourceId, patientId, metadata } =
    params;

  await logAuditEvent({
    userId,
    action: `read_${resourceType}`,
    resourceType,
    resourceId,
    metadata: {
      ...(metadata || {}),
      ...(patientId !== undefined ? { patient_id: patientId } : {}),
    },
    requestInfo: auditRequestInfo(request),
  });
}
