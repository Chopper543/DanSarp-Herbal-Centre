import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TOTP } from "otplib";
import { createHmac } from "crypto";
// @ts-ignore - base32.js doesn't have type definitions
import { decode as base32Decode } from "base32.js";

export async function POST(request: NextRequest) {
  try {
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
      secret: typedUserData.two_factor_secret,
      // @ts-ignore
      createDigest: (algorithm: string, secret: string) => {
        const secretBuffer = Buffer.from(base32Decode(secret));
        return createHmac(algorithm, secretBuffer).digest();
      },
    } as any);
    // @ts-ignore - otplib type definitions may be incorrect
    const isValidTotp = await totp.verify(code);

    // Check backup codes
    const isBackupCode = typedUserData.two_factor_backup_codes?.includes(code.toUpperCase()) || false;

    if (!isValidTotp && !isBackupCode) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // If backup code was used, remove it
    if (isBackupCode && typedUserData.two_factor_backup_codes) {
      const updatedBackupCodes = typedUserData.two_factor_backup_codes.filter(
        (c: string) => c !== code.toUpperCase()
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

    return NextResponse.json({
      success: true,
      message: "2FA verification successful",
    });
  } catch (error: any) {
    console.error("Error verifying 2FA for login:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify 2FA code" },
      { status: 500 }
    );
  }
}
