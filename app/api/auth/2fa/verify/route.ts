import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from "otplib";
import { randomBytes } from "crypto";
import { decryptSecret, hashBackupCode } from "@/lib/security/crypto";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";
import { logAuditEvent } from "@/lib/audit/log";
import { logger } from "@/lib/monitoring/logger";
import { internalError } from "@/lib/api/errors";
import { getSessionId } from "@/lib/auth/session";
import { issueTwoFactorCookie } from "@/lib/security/two-factor-cookie";

export async function POST(request: NextRequest) {
  try {
    // Rate limit 2FA verify (setup)
    const identifier = getRateLimitIdentifier(request);
    const limitResult = await checkRateLimit(identifier, "/api/auth/2fa/verify");
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

    // Get user's 2FA secret
    // @ts-ignore - Supabase type inference issue
    const { data: userData, error: fetchError } = await supabase
      .from("users")
      .select("two_factor_secret, two_factor_enabled")
      .eq("id", user.id)
      .single();

    if (fetchError || !userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const typedUserData = userData as {
      two_factor_secret?: string | null;
      two_factor_enabled?: boolean;
    };

    if (!typedUserData.two_factor_secret) {
      return NextResponse.json(
        { error: "2FA secret not found. Please generate a new secret first." },
        { status: 400 }
      );
    }

    // Verify the TOTP code. otplib v13's TOTP.verify() resolves to
    // { valid, delta, epoch } (always a truthy object), not a boolean --
    // must destructure .valid rather than treat the result itself as one.
    // It also THROWS (rather than resolving invalid) for a token that isn't
    // 6 numeric digits, so a malformed `code` must land on the normal
    // "invalid code" 400 below instead of a generic 500.
    const totp = new TOTP({
      secret: decryptSecret(typedUserData.two_factor_secret),
      crypto: new NobleCryptoPlugin(),
      base32: new ScureBase32Plugin(),
    });
    let isValid = false;
    try {
      ({ valid: isValid } = await totp.verify(code));
    } catch {
      isValid = false;
    }

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Generate backup codes (8 codes, each 8 characters)
    const backupCodes: string[] = [];
    const hashedBackupCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const code = randomBytes(4).toString("hex").toUpperCase();
      backupCodes.push(code);
      hashedBackupCodes.push(hashBackupCode(code));
    }

    // Enable 2FA and store backup codes
    // @ts-ignore - Supabase type inference issue
    const { error: updateError } = await supabase
      .from("users")
      // @ts-ignore - Supabase type inference issue
      .update({
        two_factor_enabled: true,
        two_factor_backup_codes: hashedBackupCodes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      logger.error("Failed to enable 2FA:", updateError);
      return NextResponse.json(
        { error: "Failed to enable 2FA" },
        { status: 500 }
      );
    }

    await logAuditEvent({
      userId: user.id,
      action: "2fa_enrolled",
      resourceType: "user",
      resourceId: user.id,
      metadata: { backup_codes_issued: backupCodes.length },
    });

    const response = NextResponse.json({
      success: true,
      backupCodes, // Return backup codes to user (plain, one-time)
      message: "2FA has been successfully enabled",
    });

    // Enrollment just confirmed a live OTP, so mark the session verified with
    // the server-signed, session-bound proof (same unforgeable cookie the login
    // path issues). Bind to the current Supabase session.
    const sessionId = await getSessionId(supabase);
    if (!sessionId) {
      logger.error("2FA enrollment verify: no session id available to bind proof cookie");
      return internalError(
        "/api/auth/2fa/verify",
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
    logger.error("Error verifying 2FA code:", error);
    return internalError("/api/auth/2fa/verify", error, "Failed to verify 2FA code");
  }
}
