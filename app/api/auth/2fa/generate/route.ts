import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TOTP, generateSecret, NobleCryptoPlugin, ScureBase32Plugin } from "otplib";
import QRCode from "qrcode";
import { encryptSecret } from "@/lib/security/crypto";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/monitoring/logger";
import { internalError } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    // Rate limit 2FA generate
    const identifier = getRateLimitIdentifier(request);
    const limitResult = await checkRateLimit(identifier, "/api/auth/2fa/generate");
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

    // Check if 2FA is already enabled
    // @ts-ignore - Supabase type inference issue
    const { data: userData } = await supabase
      .from("users")
      .select("two_factor_enabled, two_factor_secret")
      .eq("id", user.id)
      .single();

    const typedUserData = userData as { two_factor_enabled?: boolean; two_factor_secret?: string | null } | null;

    if (typedUserData?.two_factor_enabled) {
      return NextResponse.json(
        { error: "2FA is already enabled. Disable it first to generate a new secret." },
        { status: 400 }
      );
    }

    // Generate a new TOTP secret
    const secret = generateSecret();
    
    // Create service name for QR code (your app name)
    const serviceName = "DanSarp Herbal Centre";
    const accountName = user.email || user.id;
    
    // Generate OTP Auth URL using TOTP instance
    const totp = new TOTP({
      secret,
      crypto: new NobleCryptoPlugin(),
      base32: new ScureBase32Plugin(),
    });
    const otpAuthUrl = totp.toURI({
      label: accountName,
      issuer: serviceName,
    });

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // Store the secret temporarily (user needs to verify before enabling).
    // We'll store it encrypted in the database but not enable 2FA yet.
    // .select() forces the affected rows back so a silent RLS-blocked update
    // (0 rows, no error) can't masquerade as success.
    // @ts-ignore - Supabase type inference issue
    const { data: updatedRows, error: updateError } = await supabase
      .from("users")
      // @ts-ignore - Supabase type inference issue
      .update({
        two_factor_secret: encryptSecret(secret),
      })
      .eq("id", user.id)
      .select("id");

    if (updateError || !updatedRows || updatedRows.length === 0) {
      logger.error(
        "Failed to store 2FA secret:",
        updateError ?? new Error("update affected 0 rows (likely blocked by RLS)")
      );
      return NextResponse.json(
        { error: "Failed to generate 2FA secret" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      secret,
      qrCode: qrCodeDataUrl,
      otpAuthUrl,
    });
  } catch (error: any) {
    logger.error("Error generating 2FA secret:", error);
    return internalError("/api/auth/2fa/generate", error, "Failed to generate 2FA secret");
  }
}
