import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from "otplib";
import { decryptSecret, hashBackupCode } from "@/lib/security/crypto";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";
import { getUserRole, requires2FA } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/audit/log";
import { logger } from "@/lib/monitoring/logger";
import { internalError } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    // Rate limit 2FA disable
    const identifier = getRateLimitIdentifier(request);
    const limitResult = await checkRateLimit(identifier, "/api/auth/2fa/disable");
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

    // Staff and admin roles cannot self-disable 2FA — it's a hard requirement.
    // Removing 2FA from a privileged account requires admin intervention via
    // the user-admin tooling (out of scope for this endpoint).
    const userRole = await getUserRole();
    if (requires2FA(userRole)) {
      await logAuditEvent({
        userId: user.id,
        action: "2fa_disable_blocked",
        resourceType: "user",
        resourceId: user.id,
        metadata: { role: userRole, reason: "role_requires_2fa" },
      });
      return NextResponse.json(
        {
          error: "2FA cannot be disabled for staff accounts. Contact an administrator.",
          code: "TWOFA_DISABLE_FORBIDDEN_BY_ROLE",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { code } = body; // Optional: require verification code to disable

    // If code is provided, verify it before disabling
    if (code) {
      // @ts-ignore - Supabase type inference issue
      const { data: userData } = await supabase
        .from("users")
        .select("two_factor_secret, two_factor_backup_codes")
        .eq("id", user.id)
        .single();

      const typedUserData = userData as { two_factor_secret?: string | null; two_factor_backup_codes?: string[] | null } | null;

      if (typedUserData?.two_factor_secret) {
        // otplib v13's TOTP.verify() resolves to { valid, delta, epoch }
        // (always a truthy object), not a boolean -- must destructure .valid
        // rather than treat the result itself as one. It also THROWS (rather
        // than resolving invalid) for a token that isn't 6 numeric digits --
        // a backup code (8 hex chars) hits that every time, so a non-TOTP-
        // shaped `code` must fall through to the backup-code check below.
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

        // Also check backup codes
        const isBackupCode = typedUserData.two_factor_backup_codes?.includes(hashBackupCode(code));

        if (!isValid && !isBackupCode) {
          return NextResponse.json(
            { error: "Invalid verification code" },
            { status: 400 }
          );
        }

        // If backup code was used, remove it from the list
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
      }
    }

    // Disable 2FA and clear secret and backup codes
    // @ts-ignore - Supabase type inference issue
    const { error: updateError } = await supabase
      .from("users")
      // @ts-ignore - Supabase type inference issue
      .update({
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_backup_codes: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      logger.error("Failed to disable 2FA:", updateError);
      return NextResponse.json(
        { error: "Failed to disable 2FA" },
        { status: 500 }
      );
    }

    await logAuditEvent({
      userId: user.id,
      action: "2fa_disabled",
      resourceType: "user",
      resourceId: user.id,
      metadata: { role: userRole, verified_with_code: Boolean(code) },
    });

    const response = NextResponse.json({
      success: true,
      message: "2FA has been successfully disabled",
    });

    // Clear 2FA cookies
    response.cookies.set("twofa_verified", "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
      maxAge: 0,
    });
    response.cookies.set("twofa_required", "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
      maxAge: 0,
    });

    return response;
  } catch (error: any) {
    logger.error("Error disabling 2FA:", error);
    return internalError("/api/auth/2fa/disable", error, "Failed to disable 2FA");
  }
}
