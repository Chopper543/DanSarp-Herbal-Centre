"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { AlertCircle, Shield, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying2FA, setVerifying2FA] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Check if user has 2FA enabled
        const response = await fetch(`/api/profile?user_id=${data.user.id}`);
        if (response.ok) {
          const profileData = await response.json();
          if (profileData.user?.two_factor_enabled) {
            // User has 2FA enabled, require code
            document.cookie = "twofa_required=true; path=/; SameSite=Lax; Secure";
            setRequires2FA(true);
            setLoading(false);
            return;
          }
        }

        // No 2FA, proceed to dashboard
        document.cookie = "twofa_verified=true; path=/; SameSite=Lax; Secure; Max-Age=86400";
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying2FA(true);
    setError(null);

    if (!twoFactorCode || twoFactorCode.length !== 6) {
      setError("Please enter a valid 6-digit code");
      setVerifying2FA(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/2fa/verify-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: twoFactorCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid verification code");
      }

      // 2FA verified, proceed to dashboard
      document.cookie = "twofa_verified=true; path=/; SameSite=Lax; Secure; Max-Age=86400";
      document.cookie = "twofa_required=; path=/; SameSite=Lax; Secure; Max-Age=0";
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to verify 2FA code");
    } finally {
      setVerifying2FA(false);
    }
  };

  // Show 2FA verification form if required
  if (requires2FA) {
    return (
      <main
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-herbal-100 dark:from-gray-900 dark:to-gray-800 px-4"
        role="main"
      >
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6 lg:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full mb-4">
              <Shield className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-primary-700 dark:text-primary-400">
              Two-Factor Authentication
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Enter the 6-digit code from your authenticator app or a backup code
            </p>
          </div>

          {searchParams.get("twofa") === "1" && (
            <div
              className="mb-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200 px-4 py-3 rounded-lg text-sm"
              role="status"
              aria-live="polite"
            >
              Please complete 2FA to continue your session.
            </div>
          )}

          <form onSubmit={handle2FAVerification} className="space-y-6">
            {error && (
              <div
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex items-start gap-2"
                role="alert"
              >
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="twoFactorCode"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Verification Code or Backup Code
              </label>
              <input
                id="twoFactorCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={twoFactorCode}
                onChange={(e) =>
                  setTwoFactorCode(e.target.value.replace(/\D/g, ""))
                }
                required
                autoFocus
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white text-center text-2xl tracking-widest"
                placeholder="000000"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                You can also use a backup code if you've lost access to your authenticator app
              </p>
            </div>

            <button
              type="submit"
              disabled={verifying2FA || twoFactorCode.length !== 6}
              className="w-full bg-primary-600 hover:bg-primary-950 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {verifying2FA ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify and Continue"
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setRequires2FA(false);
                setTwoFactorCode("");
                setError(null);
              }}
              className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
            >
              Back to login
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-herbal-100 dark:from-gray-900 dark:to-gray-800 px-4" role="main">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6 lg:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2 text-primary-700 dark:text-primary-400">
          Welcome Back
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
          Sign in to your account
        </p>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
              placeholder="••••••••"
            />
            <div className="mt-2 text-right">
              <Link
                href="/forgot-password"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Forgot Password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-950 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <SocialAuthButtons onError={setError} mode="login" />

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Don't have an account?{" "}
            <Link href="/signup" className="text-primary-600 hover:text-primary-700 font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
