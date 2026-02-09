import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { assertRateLimitConfigured, checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";
import { getSecurityHeaders } from "@/lib/security/csp";
import { createClient } from "@/lib/supabase/server";
import { validateRequestSize, getMaxSizeForContentType } from "@/lib/utils/validate-request-size";
import {
  generateCsrfToken,
  isCsrfExemptPath,
  requireCsrfToken,
  setCsrfTokenCookie,
} from "@/lib/security/csrf";

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

function finalizeResponse(request: NextRequest, response: NextResponse) {
  const csrfCookie = request.cookies.get("csrf-token")?.value;
  if (!csrfCookie) {
    const token = generateCsrfToken();
    const cookie = setCsrfTokenCookie(token);
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }

  Object.entries(getSecurityHeaders()).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");
  const isWebhook = isCsrfExemptPath(pathname);
  const isMutatingMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  let authenticatedUserId: string | null = null;

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
          authenticatedUserId = user.id;
          // @ts-ignore - Supabase type inference issue
          const { data: userData } = await supabase
            .from("users")
            .select("two_factor_enabled")
            .eq("id", user.id)
            .single();

          const requires2fa = (userData as any)?.two_factor_enabled === true;

        if (requires2fa && !twofaVerified) {
          if (pathname.startsWith("/api/")) {
            return finalizeResponse(
              request,
              NextResponse.json(
                { error: "Two-factor authentication required" },
                { status: 401 }
              )
            );
          }
          const url = request.nextUrl.clone();
          url.pathname = "/login";
          url.searchParams.set("twofa", "1");
          return finalizeResponse(request, NextResponse.redirect(url));
        }
      }
    } catch (error) {
      // Fail-safe: if we can't verify, let the existing cookie check run
    }
  }

  if (!isPublicPath(pathname) && twofaRequired && !twofaVerified) {
    if (pathname.startsWith("/api/")) {
      return finalizeResponse(
        request,
        NextResponse.json(
          { error: "Two-factor authentication required" },
          { status: 401 }
        )
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("twofa", "1");
    return finalizeResponse(request, NextResponse.redirect(url));
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
        return finalizeResponse(request, sizeCheck);
      }

      const csrf = await requireCsrfToken(request);
      if (!csrf.valid) {
        return finalizeResponse(
          request,
          NextResponse.json(
            { error: csrf.error || "Invalid CSRF token" },
            { status: 403 }
          )
        );
      }
    }

    // In production, require Redis-backed rate limiting
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
        )
      );
    }

    // Skip rate limiting for webhooks (they have their own verification)
    if (isWebhook) {
      const response = await updateSession(request);
      return finalizeResponse(request, response);
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
    // Normalize clinical-notes detail routes (e.g. /api/clinical-notes/[id]) so they use the same limit
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
        )
      );
    }

    // Add rate limit headers to response
    const response = await updateSession(request);
    response.headers.set("X-RateLimit-Limit", result.limit.toString());
    response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
    response.headers.set("X-RateLimit-Reset", result.reset.toString());
    return finalizeResponse(request, response);
  }

  const response = await updateSession(request);
  return finalizeResponse(request, response);
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

