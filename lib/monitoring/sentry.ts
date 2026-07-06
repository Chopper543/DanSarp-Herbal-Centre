import * as Sentry from "@sentry/nextjs";
import { scrubBreadcrumb, scrubSentryEvent } from "@/lib/monitoring/sentry-scrub";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.NODE_ENV || "development";

export function initSentry() {
  if (!SENTRY_DSN) {
    console.warn("Sentry DSN not provided, error monitoring disabled");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    tracesSampleRate: SENTRY_ENVIRONMENT === "production" ? 0.1 : 1.0,
    debug: SENTRY_ENVIRONMENT === "development",
    sendDefaultPii: false,
    beforeSend(event, hint) {
      if (SENTRY_ENVIRONMENT === "development" && !process.env.SENTRY_DEBUG) {
        return null;
      }
      return scrubSentryEvent(event, hint);
    },
    beforeBreadcrumb: scrubBreadcrumb,
  });
}

export function captureException(error: Error, context?: Record<string, unknown>) {
  if (context) {
    Sentry.setContext("error_context", context);
  }
  Sentry.captureException(error);
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = "info") {
  Sentry.captureMessage(message, level);
}

/**
 * Healthcare context: only the opaque user id is sent to Sentry. Names and
 * email addresses must never reach the issue tracker — operators correlate
 * via id by querying the admin DB.
 */
export function setUserContext(user: { id: string }) {
  Sentry.setUser({ id: user.id });
}

export function clearUserContext() {
  Sentry.setUser(null);
}
