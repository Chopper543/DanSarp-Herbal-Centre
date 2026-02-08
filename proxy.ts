import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { assertRateLimitConfigured, checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";
import { getSecurityHeaders } from "@/lib/security/csp";
import { createClient } from "@/lib/supabase/server";
import { validateRequestSize, getMaxSizeForContentType } from "@/lib/utils/validate-request-size";
import { requireCsrfToken } from "@/lib/security/csrf";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/2fa/generate",
  "/api/auth/2fa/verify",
  "/api/auth/2fa/verify-login",
  "/api/auth/2fa/disable",
  "/api/health",
  "/_next",
  "/favicon.ico",
  "/assets",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");
  const isWebhook = pathname.startsWith("/api/webhooks/");
  const isMutatingMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);

  const twofaRequired = request.cookies.get("twofa_required")?.value === "true";
  const twofaVerified = request.cookies.get("twofa_verified")?.value === "true";

  // Enforce 2FA for all authenticated routes (except public)
  if (!isPublicPath(pathname)) {
    // Server-side check: if user has 2FA enabled but not verified, block
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // @ts-ignore - Supabase type inference issue
        const { data: userData } = await supabase
          .from("users")
          .select("two_factor_enabled")
          .eq("id", user.id)
          .single();

        const requires2fa = userData?.two_factor_enabled === true;

        if (requires2fa && !twofaVerified) {
          if (pathname.startsWith("/api/")) {
            return NextResponse.json(
              { error: "Two-factor authentication required" },
              { status: 401 }
            );
          }
          const url = request.nextUrl.clone();
          url.pathname = "/login";
          url.searchParams.set("twofa", "1");
          return NextResponse.redirect(url);
        }
      }
    } catch (error) {
      // Fail-safe: if we can't verify, let the existing cookie check run
    }
  }

  if (!isPublicPath(pathname) && twofaRequired && !twofaVerified) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Two-factor authentication required" },
        { status: 401 }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("twofa", "1");
    return NextResponse.redirect(url);
  }

  // Apply protective checks to API routes
  if (isApiRoute) {
    // Enforce CSRF and request-size limits for mutating routes (webhooks opt-out)
    if (!isWebhook && isMutatingMethod) {
      const sizeCheck = await validateRequestSize(
        request,
        getMaxSizeForContentType(request.headers.get("content-type"))
      );
      if (sizeCheck) {
        Object.entries(getSecurityHeaders()).forEach(([key, value]) => {
          sizeCheck.headers.set(key, value);
        });
        return sizeCheck;
      }

      const csrf = await requireCsrfToken(request);
      if (!csrf.valid) {
        const errorResponse = NextResponse.json(
          { error: csrf.error || "Invalid CSRF token" },
          { status: 403 }
        );
        Object.entries(getSecurityHeaders()).forEach(([key, value]) => {
          errorResponse.headers.set(key, value);
        });
        return errorResponse;
      }
    }

    // In production, require Redis-backed rate limiting
    try {
      assertRateLimitConfigured();
    } catch (error: any) {
      const misconfig = NextResponse.json(
        {
          error: "Rate limiting misconfigured",
          message: error.message,
        },
        { status: 500 }
      );
      Object.entries(getSecurityHeaders()).forEach(([key, value]) => {
        misconfig.headers.set(key, value);
      });
      return misconfig;
    }

    // Skip rate limiting for webhooks (they have their own verification)
    if (isWebhook) {
      const response = await updateSession(request);
      Object.entries(getSecurityHeaders()).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    const identifier = getRateLimitIdentifier(request);
    // Normalize clinical-notes detail routes (e.g. /api/clinical-notes/[id]) so they use the same limit
    const rateLimitPath =
      pathname.startsWith("/api/clinical-notes/") && !pathname.startsWith("/api/clinical-notes/search")
        ? "/api/clinical-notes"
        : pathname;
    const result = await checkRateLimit(identifier, rateLimitPath);

    if (!result.success) {
      const errorResponse = NextResponse.json(
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
      );
      // Add security headers to error response
      Object.entries(getSecurityHeaders()).forEach(([key, value]) => {
        errorResponse.headers.set(key, value);
      });
      return errorResponse;
    }

    // Add rate limit headers to response
    const response = await updateSession(request);
    response.headers.set("X-RateLimit-Limit", result.limit.toString());
    response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
    response.headers.set("X-RateLimit-Reset", result.reset.toString());
    // Add security headers
    Object.entries(getSecurityHeaders()).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }

  const response = await updateSession(request);
  // Add security headers to all responses
  Object.entries(getSecurityHeaders()).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

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

