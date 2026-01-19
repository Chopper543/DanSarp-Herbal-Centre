import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authenticator } from "otplib";
import QRCode from "qrcode";

export async function POST(request: NextRequest) {
  try {
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

    if (userData?.two_factor_enabled) {
      return NextResponse.json(
        { error: "2FA is already enabled. Disable it first to generate a new secret." },
        { status: 400 }
      );
    }

    // Generate a new TOTP secret
    const secret = authenticator.generateSecret();
    
    // Create service name for QR code (your app name)
    const serviceName = "DanSarp Herbal Centre";
    const accountName = user.email || user.id;
    
    // Generate OTP Auth URL
    const otpAuthUrl = authenticator.keyuri(accountName, serviceName, secret);

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // Store the secret temporarily (user needs to verify before enabling)
    // We'll store it in the database but not enable 2FA yet
    // @ts-ignore - Supabase type inference issue
    const { error: updateError } = await supabase
      .from("users")
      // @ts-ignore - Supabase type inference issue
      .update({
        two_factor_secret: secret,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to store 2FA secret:", updateError);
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
    console.error("Error generating 2FA secret:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate 2FA secret" },
      { status: 500 }
    );
  }
}
