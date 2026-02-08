import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TOTP } from "otplib";
import { createHmac, randomBytes as nodeRandomBytes, randomBytes } from "crypto";
// @ts-ignore - base32.js doesn't have type definitions
import { decode as base32Decode } from "base32.js";
import { decryptSecret, hashBackupCode } from "@/lib/security/crypto";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";

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

    // Verify the TOTP code with Node crypto
    // @ts-ignore - otplib v13 requires crypto plugin configuration
    const totp = new TOTP({
      secret: decryptSecret(typedUserData.two_factor_secret),
      // @ts-ignore
      createDigest: (algorithm: string, secret: string) => {
        const secretBuffer = Buffer.from(base32Decode(secret));
        return createHmac(algorithm, secretBuffer).digest();
      },
    } as any);
    // @ts-ignore - otplib type definitions may be incorrect
    const isValid = await totp.verify(code);

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
      console.error("Failed to enable 2FA:", updateError);
      return NextResponse.json(
        { error: "Failed to enable 2FA" },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      backupCodes, // Return backup codes to user (plain, one-time)
      message: "2FA has been successfully enabled",
    });

    // Mark session as 2FA-verified
    response.cookies.set("twofa_verified", "true", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
      maxAge: 60 * 60 * 24,
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
    console.error("Error verifying 2FA code:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify 2FA code" },
      { status: 500 }
    );
  }
}
