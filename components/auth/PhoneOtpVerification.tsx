"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPhoneForSupabase } from "@/lib/utils/phone-format";
import { AlertCircle, CheckCircle } from "lucide-react";

interface PhoneOtpVerificationProps {
  phoneNumber: string;
  onVerified: () => void;
  onError: (error: string) => void;
}

export function PhoneOtpVerification({
  phoneNumber,
  onVerified,
  onError,
}: PhoneOtpVerificationProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const supabase = createClient();

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return; // Only allow single digit
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError(null);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    if (/^\d+$/.test(pastedData)) {
      const newOtp = pastedData.split("").concat(Array(6 - pastedData.length).fill(""));
      setOtp(newOtp.slice(0, 6));
      inputRefs.current[Math.min(pastedData.length, 5)]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpCode = otp.join("");
    if (otpCode.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      // Convert phone to international format for Supabase
      const internationalPhone = formatPhoneForSupabase(phoneNumber, true); // Enable debug logging
      
      // Debug logging
      console.log("Phone OTP Verification:", {
        localFormat: phoneNumber,
        internationalFormat: internationalPhone,
        otpLength: otpCode.length
      });
      
      // For signup, we use 'sms' type which will create the user if they don't exist
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: internationalPhone,
        token: otpCode,
        type: "sms",
      });

      if (verifyError) {
        console.error("OTP Verification Error:", {
          error: verifyError,
          message: verifyError.message,
          phone: internationalPhone
        });
        throw verifyError;
      }

      if (data.user) {
        console.log("OTP verified successfully for:", internationalPhone);
        onVerified();
      }
    } catch (err: any) {
      const errorMessage = err.message || "Invalid verification code. Please try again.";
      
      // Check for specific Supabase errors
      if (errorMessage.includes("Unsupported phone provider") || 
          errorMessage.includes("phone provider")) {
        setError(
          "Phone authentication error. Please ensure phone auth is enabled in Supabase settings."
        );
      } else {
        setError(errorMessage);
      }
      
      // Clear OTP on error
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setResendLoading(true);
    setError(null);

    try {
      // Convert phone to international format for Supabase
      const internationalPhone = formatPhoneForSupabase(phoneNumber, true); // Enable debug logging
      
      // Debug logging
      console.log("Resending OTP:", {
        localFormat: phoneNumber,
        internationalFormat: internationalPhone
      });
      
      const { error: resendError } = await supabase.auth.signInWithOtp({
        phone: internationalPhone,
        options: {
          channel: "sms",
        },
      });

      if (resendError) {
        console.error("Resend OTP Error:", {
          error: resendError,
          message: resendError.message,
          phone: internationalPhone
        });
        throw resendError;
      }

      console.log("OTP resent successfully to:", internationalPhone);
      setResendCooldown(60); // 60 second cooldown
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      const errorMessage = err.message || "Failed to resend code. Please try again.";
      
      // Check for specific Supabase errors
      if (errorMessage.includes("Unsupported phone provider") || 
          errorMessage.includes("phone provider")) {
        setError(
          "Phone authentication error. Please ensure phone auth is enabled in Supabase settings."
        );
      } else {
        setError(errorMessage);
      }
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          We've sent a 6-digit verification code to <strong>{phoneNumber}</strong>
        </p>

        <div className="flex gap-2 justify-center mb-4">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              className="w-12 h-14 text-center text-xl font-semibold border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
            />
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm mb-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleVerify}
          disabled={verifying || otp.join("").length !== 6}
          className="w-full bg-primary-600 hover:bg-primary-950 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {verifying ? "Verifying..." : "Verify Code"}
        </button>
      </div>

      <div className="text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={resendLoading || resendCooldown > 0}
          className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resendLoading
            ? "Sending..."
            : resendCooldown > 0
            ? `Resend code in ${resendCooldown}s`
            : "Resend verification code"}
        </button>
      </div>
    </div>
  );
}
