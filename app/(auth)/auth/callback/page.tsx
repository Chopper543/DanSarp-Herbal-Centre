"use client";

import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the code and other params from URL
        const code = searchParams.get("code");
        const error_code = searchParams.get("error");
        const error_description = searchParams.get("error_description");

        if (error_code) {
          throw new Error(error_description || "Authentication failed");
        }

        if (!code) {
          throw new Error("No authorization code received");
        }

        // Exchange code for session
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) throw exchangeError;

        if (data.user) {
          // Upsert public.users so a row always exists (trigger may have created it; this is fallback and backfill)
          const phone = data.user.phone || data.user.user_metadata?.phone;
          const fullName = data.user.user_metadata?.full_name || data.user.user_metadata?.name;
          const payload = {
            id: data.user.id,
            email: data.user.email ?? "",
            full_name: fullName ?? null,
            phone: phone ?? null,
            email_verified: !!data.user.email_confirmed_at,
          };
          // @ts-ignore - Supabase type inference issue with users table
          await supabase.from("users").upsert(payload, { onConflict: "id" });

          setStatus("success");
          // Redirect to dashboard after a brief delay
          setTimeout(() => {
            router.push("/dashboard");
            router.refresh();
          }, 1500);
        } else {
          throw new Error("User not found after authentication");
        }
      } catch (err: any) {
        setError(err.message || "Authentication failed");
        setStatus("error");
      }
    };

    handleCallback();
  }, [searchParams, router, supabase]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-herbal-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <Loader2 className="w-12 h-12 text-primary-600 dark:text-primary-400 animate-spin mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-primary-700 dark:text-primary-400">
            Completing sign in...
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Please wait while we complete your authentication.
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-herbal-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-2 text-primary-700 dark:text-primary-400">
            Authentication Failed
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push("/login")}
            className="w-full bg-primary-600 hover:bg-primary-950 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-herbal-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
        <div className="mb-4">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2 text-primary-700 dark:text-primary-400">
          Success!
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          You've been successfully signed in. Redirecting to dashboard...
        </p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-herbal-100 dark:from-gray-900 dark:to-gray-800 px-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
            <Loader2 className="w-12 h-12 text-primary-600 dark:text-primary-400 animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2 text-primary-700 dark:text-primary-400">
              Loading...
            </h1>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
