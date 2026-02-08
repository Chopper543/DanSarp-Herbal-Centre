import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TOTP, generateSecret } from "otplib";
import { createHmac, randomBytes as nodeRandomBytes } from "crypto";
// @ts-ignore - base32.js doesn't have type definitions
import { decode as base32Decode } from "base32.js";
import QRCode from "qrcode";
import { encryptSecret } from "@/lib/security/crypto";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";

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
    
    // Generate OTP Auth URL using TOTP instance with Node crypto
    // @ts-ignore - otplib v13 requires crypto plugin configuration
    const totp = new TOTP({
      secret,
      // @ts-ignore
      createDigest: (algorithm: string, secret: string) => {
        const secretBuffer = Buffer.from(base32Decode(secret));
        return createHmac(algorithm, secretBuffer).digest();
      },
      // @ts-ignore
      createRandomBytes: (size: number) => {
        return Promise.resolve(nodeRandomBytes(size));
      },
    } as any);
    const otpAuthUrl = totp.toURI({
      label: accountName,
      issuer: serviceName,
    });

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // Store the secret temporarily (user needs to verify before enabling)
    // We'll store it encrypted in the database but not enable 2FA yet
    // @ts-ignore - Supabase type inference issue
    const { error: updateError } = await supabase
      .from("users")
      // @ts-ignore - Supabase type inference issue
      .update({
        two_factor_secret: encryptSecret(secret),
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
