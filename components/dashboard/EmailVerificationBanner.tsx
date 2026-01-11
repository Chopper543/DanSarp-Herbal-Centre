"use client";

import { X, Mail } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface EmailVerificationBannerProps {
  email: string;
  emailVerified: boolean;
}

export function EmailVerificationBanner({
  email,
  emailVerified,
}: EmailVerificationBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const supabase = createClient();

  if (emailVerified || dismissed) {
    return null;
  }

  const handleResendVerification = async () => {
    setSending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email,
      });

      if (error) {
        throw error;
      }

      alert("Verification email sent! Please check your inbox.");
    } catch (error: any) {
      alert("Failed to send verification email: " + error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <Mail className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
              Verify Your Email
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-3">
              Please verify your email address ({email}) to access all features.
            </p>
            <button
              onClick={handleResendVerification}
              disabled={sending}
              className="text-sm px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {sending ? "Sending..." : "Resend Verification Email"}
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
