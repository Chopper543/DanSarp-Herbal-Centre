import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/monitoring/logger";

/**
 * Email-link verification (signup confirmation, password recovery, magic link,
 * email change). Uses the server-side `verifyOtp({ token_hash, type })` flow
 * instead of the client-side PKCE `exchangeCodeForSession`.
 *
 * Why: PKCE ties a code verifier to the originating browser, so confirmation
 * links broke when opened on another device, in incognito, or after an email
 * scanner pre-fetched them ("PKCE code verifier not found in storage").
 * token_hash carries no verifier — the link works anywhere and survives
 * prefetch — and the session is written to cookies here on the server.
 *
 * Drive this route from the Supabase email templates (see AUTH_EMAIL_TEMPLATES.md):
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<type>&next=<path>
 */

const VALID_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

// Only allow same-origin relative redirects (no open-redirects via ?next=).
function safeNext(next: string | null, fallback: string): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return fallback;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const defaultNext = type === "recovery" ? "/reset-password" : "/dashboard";
  const next = safeNext(searchParams.get("next"), defaultNext);

  if (!tokenHash || !type || !VALID_TYPES.includes(type)) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Invalid or missing confirmation link.")}`
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error || !data.user) {
    logger.warn("Email OTP verification failed", error, { type });
    // Recovery failures should route back to request a fresh reset link.
    const dest = type === "recovery" ? "/forgot-password" : "/login";
    return NextResponse.redirect(
      `${origin}${dest}?error=${encodeURIComponent(
        error?.message || "This link is invalid or has expired. Please request a new one."
      )}`
    );
  }

  // Backfill public.users (the auth trigger may already have created the row).
  const user = data.user;
  try {
    await supabase
      .from("users")
      // @ts-ignore - Supabase type inference issue with users upsert payload
      .upsert(
        {
          id: user.id,
          email: user.email ?? "",
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
          phone: user.phone || user.user_metadata?.phone || null,
          email_verified: !!user.email_confirmed_at,
        },
        { onConflict: "id" }
      );
  } catch (backfillError) {
    logger.error("users backfill after email verification failed", backfillError);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
