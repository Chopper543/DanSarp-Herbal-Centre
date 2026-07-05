import { cookies } from "next/headers";
import crypto from "crypto";

const CSRF_TOKEN_NAME = "csrf-token";
const CSRF_TOKEN_HEADER = "x-csrf-token";
const CSRF_EXEMPT_PATHS = [
  "/api/webhooks/",
  "/api/payments/ghana-rails/webhook",
];

export const CSRF_COOKIE_NAME = CSRF_TOKEN_NAME;
export const CSRF_HEADER_NAME = CSRF_TOKEN_HEADER;

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function isCsrfExemptPath(pathname: string): boolean {
  return CSRF_EXEMPT_PATHS.some((path) =>
    path.endsWith("/") ? pathname.startsWith(path) : pathname === path
  );
}

export async function getCsrfToken(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_TOKEN_NAME)?.value ?? generateCsrfToken();
}

export async function validateCsrfToken(
  requestToken: string | null,
  sessionTokenOverride?: string | null
): Promise<boolean> {
  if (!requestToken) return false;

  const sessionToken =
    sessionTokenOverride !== undefined
      ? sessionTokenOverride
      : (await cookies()).get(CSRF_TOKEN_NAME)?.value;

  if (!sessionToken) return false;
  if (requestToken.length !== sessionToken.length) return false;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(requestToken),
      Buffer.from(sessionToken)
    );
  } catch {
    return false;
  }
}

export interface CsrfCookieDescriptor {
  name: string;
  value: string;
  options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "strict";
    path: string;
    maxAge: number;
  };
}

/**
 * The CSRF cookie is httpOnly. The token is delivered to the browser as a
 * <meta name="csrf-token"> rendered server-side by the root layout, which
 * reads it from the `x-csrf-token` request header injected by middleware.
 * The client-side fetch interceptor reads the meta tag (not the cookie) and
 * sets X-CSRF-Token on every same-origin mutating request.
 */
export function setCsrfTokenCookie(token: string): CsrfCookieDescriptor {
  return {
    name: CSRF_TOKEN_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict" as const,
      path: "/",
      maxAge: 60 * 60 * 24,
    },
  };
}

/**
 * Defense-in-depth: reject mutating requests whose Origin (or Referer if no
 * Origin) doesn't match an expected host. SameSite=Strict already prevents
 * most cross-site CSRF; this catches the few edge cases (e.g. older clients,
 * service workers) and stops same-origin attacks via DNS rebinding.
 */
function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    try {
      origins.add(new URL(siteUrl).origin);
    } catch {
      // ignore malformed value; env validator catches this at boot
    }
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      origins.add(new URL(appUrl).origin);
    } catch {
      // ignore
    }
  }
  return origins;
}

function isOriginAllowed(request: Request): boolean {
  const allowed = getAllowedOrigins();
  if (allowed.size === 0) return true;

  const origin = request.headers.get("origin");
  if (origin) return allowed.has(origin);

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return allowed.has(new URL(referer).origin);
    } catch {
      return false;
    }
  }

  // No Origin and no Referer is suspicious for a state-changing request.
  return false;
}

export async function requireCsrfToken(
  request: Request,
  tokenFromBody?: string
): Promise<{ valid: boolean; error?: string }> {
  const method = request.method;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return { valid: true };
  }

  const url = new URL(request.url);
  if (isCsrfExemptPath(url.pathname)) {
    return { valid: true };
  }

  if (!isOriginAllowed(request)) {
    return { valid: false, error: "Origin not allowed for this request." };
  }

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
