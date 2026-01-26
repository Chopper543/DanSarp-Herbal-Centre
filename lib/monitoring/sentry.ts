import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.NODE_ENV || "development";

/**
 * Initialize Sentry if DSN is provided
 */
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
    beforeSend(event, hint) {
      // Don't send errors in development unless explicitly enabled
      if (SENTRY_ENVIRONMENT === "development" && !process.env.SENTRY_DEBUG) {
        return null;
      }
      return event;
    },
  });
}

/**
 * Capture an exception
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (context) {
    Sentry.setContext("error_context", context);
  }
  Sentry.captureException(error);
}

/**
 * Capture a message
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = "info") {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context for error tracking
 */
export function setUserContext(user: { id: string; email?: string; name?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
  });
}

/**
 * Clear user context
 */
export function clearUserContext() {
  Sentry.setUser(null);
}
