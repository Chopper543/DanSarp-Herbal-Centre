import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TOTP } from "otplib";
import { createHmac } from "crypto";
// @ts-ignore - base32.js doesn't have type definitions
import { decode as base32Decode } from "base32.js";
import { decryptSecret, hashBackupCode } from "@/lib/security/crypto";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";
import { logAuditEvent } from "@/lib/audit/log";
import { logger } from "@/lib/monitoring/logger";
import { internalError } from "@/lib/api/errors";
import { getSessionId } from "@/lib/auth/session";
import { issueTwoFactorCookie } from "@/lib/security/two-factor-cookie";

function requestInfoFrom(request: NextRequest) {
  return {
    ip: request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || null,
    userAgent: request.headers.get("user-agent"),
    path: new URL(request.url).pathname,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit 2FA verify-login
    const identifier = getRateLimitIdentifier(request);
    const limitResult = await checkRateLimit(identifier, "/api/auth/2fa/verify-login");
    if (!limitResult.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limitResult.limit.toString(),
            "X-RateLimit-Remaining": limitResult.remaining.toString(),
            "X-RateLimit-Reset": limitResult.reset.toString(),
            "Retry-After": (limitResult.reset - Math.floor(Date.now() / 1000)).toString(),
          },
        }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Verification code is required" },
        { status: 400 }
      );
    }

    // Get user's 2FA secret and backup codes
    // @ts-ignore - Supabase type inference issue
    const { data: userData, error: fetchError } = await supabase
      .from("users")
      .select("two_factor_secret, two_factor_backup_codes, two_factor_enabled")
      .eq("id", user.id)
      .single();

    if (fetchError || !userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const typedUserData = userData as {
      two_factor_enabled?: boolean;
      two_factor_secret?: string | null;
      two_factor_backup_codes?: string[] | null;
    };

    if (!typedUserData.two_factor_enabled) {
      return NextResponse.json(
        { error: "2FA is not enabled for this account" },
        { status: 400 }
      );
    }

    if (!typedUserData.two_factor_secret) {
      return NextResponse.json(
        { error: "2FA secret not found" },
        { status: 500 }
      );
    }

    // Verify TOTP code with Node crypto
    // @ts-ignore - otplib v13 requires crypto plugin configuration
    const totp = new TOTP({
      secret: decryptSecret(typedUserData.two_factor_secret),
      // @ts-ignore - supabase type inference
      createDigest: (algorithm: string, secret: string) => {
        const secretBuffer = Buffer.from(base32Decode(secret));
        return createHmac(algorithm, secretBuffer).digest();
      },
    } as any);
    // @ts-ignore - otplib type definitions may be incorrect
    const isValidTotp = await totp.verify(code);

    // Check backup codes (hashed)
    const isBackupCode = typedUserData.two_factor_backup_codes?.includes(hashBackupCode(code)) || false;

    if (!isValidTotp && !isBackupCode) {
      await logAuditEvent({
        userId: user.id,
        action: "2fa_verify_login_failed",
        resourceType: "user",
        resourceId: user.id,
        requestInfo: requestInfoFrom(request),
      });
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // If backup code was used, remove it
    if (isBackupCode && typedUserData.two_factor_backup_codes) {
      const updatedBackupCodes = typedUserData.two_factor_backup_codes.filter(
        (c: string) => c !== hashBackupCode(code)
      );

      // @ts-ignore - Supabase type inference issue
      await supabase
        .from("users")
        // @ts-ignore - Supabase type inference issue
        .update({
          two_factor_backup_codes: updatedBackupCodes,
        })
        .eq("id", user.id);
    }

    await logAuditEvent({
      userId: user.id,
      action: "2fa_verify_login_success",
      resourceType: "user",
      resourceId: user.id,
      metadata: {
        method: isBackupCode ? "backup_code" : "totp",
        backup_codes_remaining: isBackupCode
          ? (typedUserData.two_factor_backup_codes?.length || 1) - 1
          : (typedUserData.two_factor_backup_codes?.length || 0),
      },
      requestInfo: requestInfoFrom(request),
    });

    const response = NextResponse.json({
      success: true,
      message: "2FA verification successful",
    });

    // Issue the server-signed, session-bound 2FA proof. The middleware trusts
    // ONLY this HMAC cookie (never a raw value), so it cannot be forged, and
    // binding it to the current Supabase session means it dies on logout/rotation
    // and can't be replayed into another session.
    const sessionId = await getSessionId(supabase);
    if (!sessionId) {
      logger.error("2FA verify-login: no session id available to bind proof cookie");
      return internalError(
        "/api/auth/2fa/verify-login",
        new Error("missing session id"),
        "Failed to establish 2FA session"
      );
    }
    const twofaCookie = issueTwoFactorCookie(user.id, sessionId);
    response.cookies.set(twofaCookie.name, twofaCookie.value, twofaCookie.options);
    // Clear the legacy client-set requirement flag (no longer consulted by the gate).
    response.cookies.set("twofa_required", "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
      maxAge: 0,
    });

    return response;
  } catch (error: any) {
    logger.error("Error verifying 2FA for login:", error);
    return internalError("/api/auth/2fa/verify-login", error, "Failed to verify 2FA code");
  }
}
