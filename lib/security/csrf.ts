import { cookies } from "next/headers";
import crypto from "crypto";

const CSRF_TOKEN_NAME = "csrf-token";
const CSRF_TOKEN_HEADER = "x-csrf-token";
const CSRF_EXEMPT_PATHS = [
  "/api/webhooks/",
  "/api/payments/ghana-rails/webhook",
];

/**
 * Generates a CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function isCsrfExemptPath(pathname: string): boolean {
  return CSRF_EXEMPT_PATHS.some((path) =>
    path.endsWith("/") ? pathname.startsWith(path) : pathname === path
  );
}

/**
 * Gets or creates a CSRF token for the current session
 */
export async function getCsrfToken(): Promise<string> {
  const cookieStore = await cookies();
  let token = cookieStore.get(CSRF_TOKEN_NAME)?.value;

  if (!token) {
    token = generateCsrfToken();
    // Token will be set via setCsrfTokenCookie
  }

  return token;
}

/**
 * Validates a CSRF token from the request
 * @param requestToken - Token from request header or body
 * @returns true if token is valid
 */
export async function validateCsrfToken(
  requestToken: string | null,
  sessionTokenOverride?: string | null
): Promise<boolean> {
  if (!requestToken) {
    return false;
  }

  const sessionToken =
    sessionTokenOverride !== undefined
      ? sessionTokenOverride
      : (await cookies()).get(CSRF_TOKEN_NAME)?.value;

  if (!sessionToken) {
    return false;
  }

  // timingSafeEqual throws if buffer lengths differ.
  if (requestToken.length !== sessionToken.length) {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(requestToken),
      Buffer.from(sessionToken)
    );
  } catch {
    return false;
  }
}

/**
 * Sets CSRF token cookie in response
 */
export function setCsrfTokenCookie(token: string): { name: string; value: string; options: any } {
  return {
    name: CSRF_TOKEN_NAME,
    value: token,
    options: {
      // Must be readable by client fetch interceptor to set X-CSRF-Token.
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict" as const,
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    },
  };
}

/**
 * Middleware to validate CSRF token for state-changing requests
 */
export async function requireCsrfToken(
  request: Request,
  tokenFromBody?: string
): Promise<{ valid: boolean; error?: string }> {
  // Only validate POST, PUT, PATCH, DELETE requests
  const method = request.method;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return { valid: true };
  }

  // Skip CSRF validation for webhooks (they have their own signature verification)
  const url = new URL(request.url);
  if (isCsrfExemptPath(url.pathname)) {
    return { valid: true };
  }

  // Get token from header or body
  const headerToken = request.headers.get(CSRF_TOKEN_HEADER);
  const token = headerToken || tokenFromBody;

  if (!token) {
    return {
      valid: false,
      error: "CSRF token is required. Please include it in the X-CSRF-Token header or request body.",
    };
  }

  const cookieHeader = request.headers.get("cookie");
  const sessionToken =
    cookieHeader
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${CSRF_TOKEN_NAME}=`))
      ?.slice(`${CSRF_TOKEN_NAME}=`.length) || null;

  const isValid = await validateCsrfToken(token, sessionToken);
  if (!isValid) {
    return {
      valid: false,
      error: "Invalid CSRF token. Please refresh the page and try again.",
    };
  }

  return { valid: true };
}
