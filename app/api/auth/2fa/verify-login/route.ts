import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authenticator } from "otplib";

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

    if (!userData.two_factor_enabled) {
      return NextResponse.json(
        { error: "2FA is not enabled for this account" },
        { status: 400 }
      );
    }

    if (!userData.two_factor_secret) {
      return NextResponse.json(
        { error: "2FA secret not found" },
        { status: 500 }
      );
    }

    // Verify TOTP code
    const isValidTotp = authenticator.verify({
      token: code,
      secret: userData.two_factor_secret,
    });

    // Check backup codes
    const isBackupCode = userData.two_factor_backup_codes?.includes(code.toUpperCase()) || false;

    if (!isValidTotp && !isBackupCode) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // If backup code was used, remove it
    if (isBackupCode && userData.two_factor_backup_codes) {
      const updatedBackupCodes = userData.two_factor_backup_codes.filter(
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
