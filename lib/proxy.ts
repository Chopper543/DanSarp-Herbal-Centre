import { type NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { updateSession } from "@/lib/supabase/middleware";
import { assertRateLimitConfigured, checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";
import { buildCsp, getStaticSecurityHeaders } from "@/lib/security/csp";
import { createClient } from "@/lib/supabase/server";
import { validateRequestSize, getMaxSizeForContentType } from "@/lib/utils/validate-request-size";
import {
  CSRF_COOKIE_NAME,
  generateCsrfToken,
  isCsrfExemptPath,
  requireCsrfToken,
  setCsrfTokenCookie,
} from "@/lib/security/csrf";
import { requires2FA } from "@/lib/auth/rbac";
import { getSessionId } from "@/lib/auth/session";
import {
  TWO_FA_COOKIE_NAME,
  verifyTwoFactorCookie,
} from "@/lib/security/two-factor-cookie";
import type { UserRole } from "@/types";

const PUBLIC_PATHS = [
  "/login",
  // Auth pages must stay reachable regardless of session/2FA state — e.g. a
  // 2FA-enrolled user completing a password reset arrives at /reset-password
  // with a recovery session (set server-side by /auth/confirm) and must not be
  // bounced to the 2FA challenge before they can set a new password.
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/auth/confirm",
  "/api/auth/2fa/generate",
  "/api/auth/2fa/verify",
  "/api/auth/2fa/verify-login",
  "/api/auth/2fa/disable",
  "/api/health",
  "/_next",
  "/favicon.ico",
  "/assets",
];

/**
 * Paths a staff user can reach BEFORE completing 2FA enrollment. They have a
 * valid session (password-authenticated) but cannot use the rest of the app
 * until they enroll. Keep this tight — anything not here is gated.
 */
const ENROLLMENT_ALLOWED_PATHS = [
  "/setup-2fa",
  "/api/auth/2fa/generate",
  "/api/auth/2fa/verify",
  "/api/auth/logout",
  "/api/profile",
  "/api/health",
  "/_next",
  "/favicon.ico",
  "/assets",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

function isEnrollmentAllowedPath(pathname: string) {
  return ENROLLMENT_ALLOWED_PATHS.some((p) => pathname.startsWith(p));
}

interface RequestContext {
  nonce: string;
  csrfToken: string;
  isNewCsrfToken: boolean;
}

function buildRequestContext(request: NextRequest): RequestContext {
  const nonce = crypto.randomBytes(16).toString("base64");
  const existing = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (existing) {
    return { nonce, csrfToken: existing, isNewCsrfToken: false };
  }
  return { nonce, csrfToken: generateCsrfToken(), isNewCsrfToken: true };
}

function finalizeResponse(
  request: NextRequest,
  response: NextResponse,
  ctx: RequestContext
) {
  if (ctx.isNewCsrfToken) {
    const cookie = setCsrfTokenCookie(ctx.csrfToken);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }

  const isDev = process.env.NODE_ENV !== "production";
  response.headers.set("Content-Security-Policy", buildCsp({ nonce: ctx.nonce, isDev }));
  Object.entries(getStaticSecurityHeaders()).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * Forward per-request nonce + CSRF token to downstream RSC/route handlers via
 * request headers. The root layout reads them with next/headers and renders
 * the meta tag + script nonces.
 */
function withContextHeaders(request: NextRequest, ctx: RequestContext): Headers {
  const headers = new Headers(request.headers);
  headers.set("x-nonce", ctx.nonce);
  headers.set("x-csrf-token", ctx.csrfToken);
  return headers;
}

export async function proxy(request: NextRequest) {
  const ctx = buildRequestContext(request);
  const forwarded = { "x-nonce": ctx.nonce, "x-csrf-token": ctx.csrfToken };

  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");
  const isWebhook = isCsrfExemptPath(pathname);
  const isMutatingMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  let authenticatedUserId: string | null = null;

  // Enforce 2FA for all authenticated routes (except public)
  if (!isPublicPath(pathname)) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        authenticatedUserId = user.id;
        // @ts-ignore - Supabase type inference issue
        const { data: userData } = await supabase
          .from("users")
          .select("two_factor_enabled, role")
          .eq("id", user.id)
          .single();

        const twofaEnrolled = (userData as any)?.two_factor_enabled === true;
        const userRole = ((userData as any)?.role as UserRole | null) ?? null;
        const mustEnroll = requires2FA(userRole) && !twofaEnrolled;

        // Staff role + not yet enrolled → force them to /setup-2fa. They keep
        // their session but can only touch the enrollment surface.
        if (mustEnroll && !isEnrollmentAllowedPath(pathname)) {
          if (pathname.startsWith("/api/")) {
            return finalizeResponse(
              request,
              NextResponse.json(
                {
                  error: "Two-factor enrollment required",
                  code: "TWOFA_ENROLLMENT_REQUIRED",
                },
                { status: 403 }
              ),
              ctx
            );
          }
          const url = request.nextUrl.clone();
          url.pathname = "/setup-2fa";
          url.searchParams.set("required", "1");
          return finalizeResponse(request, NextResponse.redirect(url), ctx);
        }

        // "2FA satisfied" is derived ONLY from the server-signed, session-bound
        // cookie — never from a raw client-writable value. A forged
        // `twofa_verified=true`, or a proof minted for a different session,
        // fails HMAC verification and is treated as unverified.
        const sessionId = await getSessionId(supabase);
        const twofaVerified = verifyTwoFactorCookie(
          request.cookies.get(TWO_FA_COOKIE_NAME)?.value,
          user.id,
          sessionId
        );

        // Enrolled but session hasn't completed the OTP challenge →
        // redirect-to-login path.
        if (twofaEnrolled && !twofaVerified) {
          if (pathname.startsWith("/api/")) {
            return finalizeResponse(
              request,
              NextResponse.json(
                { error: "Two-factor authentication required" },
                { status: 401 }
              ),
              ctx
            );
          }
          const url = request.nextUrl.clone();
          url.pathname = "/login";
          url.searchParams.set("twofa", "1");
          return finalizeResponse(request, NextResponse.redirect(url), ctx);
        }
      }
    } catch {
      // Fail-safe: if we can't verify, let the existing cookie check run
    }
  }

  // Apply protective checks to API routes
  if (isApiRoute) {
    if (!isWebhook && isMutatingMethod) {
      const sizeCheck = await validateRequestSize(
        request,
        getMaxSizeForContentType(request.headers.get("content-type"))
      );
      if (sizeCheck) {
        return finalizeResponse(request, sizeCheck, ctx);
      }

      const csrf = await requireCsrfToken(request);
      if (!csrf.valid) {
        return finalizeResponse(
          request,
          NextResponse.json(
            { error: csrf.error || "Invalid CSRF token" },
            { status: 403 }
          ),
          ctx
        );
      }
    }

    try {
      assertRateLimitConfigured();
    } catch (error: any) {
      return finalizeResponse(
        request,
        NextResponse.json(
          {
            error: "Rate limiting misconfigured",
            message: error.message,
          },
          { status: 500 }
        ),
        ctx
      );
    }

    if (isWebhook) {
      const response = await updateSession(request, { forwardedHeaders: forwarded });
      return finalizeResponse(request, response, ctx);
    }

    let rateLimitUserId = authenticatedUserId;
    if (!rateLimitUserId) {
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        rateLimitUserId = user?.id || null;
      } catch {
        rateLimitUserId = null;
      }
    }

    const identifier = getRateLimitIdentifier(request, rateLimitUserId);
    const rateLimitPath =
      pathname.startsWith("/api/clinical-notes/") && !pathname.startsWith("/api/clinical-notes/search")
        ? "/api/clinical-notes"
        : pathname;
    const result = await checkRateLimit(identifier, rateLimitPath);

    if (!result.success) {
      return finalizeResponse(
        request,
        NextResponse.json(
          {
            error: "Too many requests",
            message: "Rate limit exceeded. Please try again later.",
          },
          {
            status: 429,
            headers: {
              "X-RateLimit-Limit": result.limit.toString(),
              "X-RateLimit-Remaining": result.remaining.toString(),
              "X-RateLimit-Reset": result.reset.toString(),
              "Retry-After": (result.reset - Math.floor(Date.now() / 1000)).toString(),
            },
          }
        ),
        ctx
      );
    }

    const response = await updateSession(request, { forwardedHeaders: forwarded });
    response.headers.set("X-RateLimit-Limit", result.limit.toString());
    response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
    response.headers.set("X-RateLimit-Reset", result.reset.toString());
    return finalizeResponse(request, response, ctx);
  }

  const response = await updateSession(request, { forwardedHeaders: forwarded });
  return finalizeResponse(request, response, ctx);
}

// Keep helper exported for tests/future use; intentionally unused locally.
export { withContextHeaders };

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

