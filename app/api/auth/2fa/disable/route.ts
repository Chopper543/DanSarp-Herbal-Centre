import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const { code } = body; // Optional: require verification code to disable

    // If code is provided, verify it before disabling
    if (code) {
      // @ts-ignore - Supabase type inference issue
      const { data: userData } = await supabase
        .from("users")
        .select("two_factor_secret, two_factor_backup_codes")
        .eq("id", user.id)
        .single();

      if (userData?.two_factor_secret) {
        const { authenticator } = await import("otplib");
        const isValid = authenticator.verify({
          token: code,
          secret: userData.two_factor_secret,
        });

        // Also check backup codes
        const isBackupCode = userData.two_factor_backup_codes?.includes(code.toUpperCase());

        if (!isValid && !isBackupCode) {
          return NextResponse.json(
            { error: "Invalid verification code" },
            { status: 400 }
          );
        }

        // If backup code was used, remove it from the list
        if (isBackupCode) {
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
      console.error("Failed to disable 2FA:", updateError);
      return NextResponse.json(
        { error: "Failed to disable 2FA" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "2FA has been successfully disabled",
    });
  } catch (error: any) {
    console.error("Error disabling 2FA:", error);
    return NextResponse.json(
      { error: error.message || "Failed to disable 2FA" },
      { status: 500 }
    );
  }
}
