import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authenticator } from "otplib";
import { randomBytes } from "crypto";

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

    if (!userData.two_factor_secret) {
      return NextResponse.json(
        { error: "2FA secret not found. Please generate a new secret first." },
        { status: 400 }
      );
    }

    // Verify the TOTP code
    const isValid = authenticator.verify({
      token: code,
      secret: userData.two_factor_secret,
    });

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Generate backup codes (8 codes, each 8 characters)
    const backupCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const code = randomBytes(4).toString("hex").toUpperCase();
      backupCodes.push(code);
    }

    // Enable 2FA and store backup codes
    // @ts-ignore - Supabase type inference issue
    const { error: updateError } = await supabase
      .from("users")
      // @ts-ignore - Supabase type inference issue
      .update({
        two_factor_enabled: true,
        two_factor_backup_codes: backupCodes,
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

    return NextResponse.json({
      success: true,
      backupCodes, // Return backup codes to user (they should save these)
      message: "2FA has been successfully enabled",
    });
  } catch (error: any) {
    console.error("Error verifying 2FA code:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify 2FA code" },
      { status: 500 }
    );
  }
}
