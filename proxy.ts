import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";
import { getSecurityHeaders } from "@/lib/security/csp";
import { createClient } from "@/lib/supabase/server";

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

  // Apply rate limiting to API routes
  if (pathname.startsWith("/api/")) {
    // Skip rate limiting for webhooks (they have their own verification)
    if (pathname.startsWith("/api/webhooks/")) {
      const response = await updateSession(request);
      // Add security headers
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

