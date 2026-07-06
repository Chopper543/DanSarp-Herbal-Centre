import { NextResponse } from "next/server";
import { logger } from "@/lib/monitoring/logger";

/**
 * Standard 500 response for unexpected errors.
 *
 * Logs the full error server-side (Sentry in production via `logger`) and
 * returns a generic, non-leaking message to the client. Use this in catch
 * blocks instead of echoing `error.message` — raw exception text can disclose
 * database structure, stack traces, file paths, or internal configuration.
 *
 * @param context short description of where the failure happened, e.g.
 *   "GET /api/appointments". Becomes the log message.
 */
export function internalError(
  context: string,
  error: unknown,
  clientMessage = "An unexpected error occurred. Please try again."
): NextResponse {
  logger.error(context, error);
  return NextResponse.json({ error: clientMessage }, { status: 500 });
}

/**
 * Standard 400 response for failed operations whose underlying error must not
 * be echoed to the client. Logs the real error server-side (`warn` — these are
 * request/DB-level, not server crashes) and returns a safe, generic message.
 *
 * Use for catch blocks and DB-error branches that currently return
 * `error.message` — raw Postgres/Supabase text leaks table, column, and
 * constraint names. Pass an explicit `clientMessage` when a specific,
 * non-sensitive hint is genuinely useful to the caller.
 *
 * @param context short description, e.g. "POST /api/reviews".
 */
/**
 * Catch-block helper for routes that authorize via `requireAuth`, which throws
 * `Error("Unauthorized")` / `Error("Forbidden")`. Maps those to 401/403 with
 * their (safe, controlled) message, and treats anything else as a genuine 500:
 * logged server-side, generic `fallbackMessage` to the client. Never echoes a
 * raw `error.message`.
 */
export function authAwareError(
  context: string,
  error: unknown,
  fallbackMessage: string
): NextResponse {
  const message = (error as { message?: string } | null)?.message;
  if (message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (message === "Forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  logger.error(context, error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export function badRequest(
  context: string,
  error: unknown,
  clientMessage = "The request could not be completed."
): NextResponse {
  logger.warn(context, error);
  return NextResponse.json({ error: clientMessage }, { status: 400 });
}
