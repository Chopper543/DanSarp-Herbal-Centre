"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { validateGhanaPhoneNumber, formatGhanaPhoneNumber } from "@/lib/payments/validation";
import { Phone, Mail, AlertCircle } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Allow + prefix for international format
    if (value.startsWith('+')) {
      // Keep + and digits only
      value = '+' + value.slice(1).replace(/\D/g, '');
    } else {
      // Remove all non-digits for local format
      value = value.replace(/\D/g, '');
    }
    
    // Auto-format: if user types 0, keep local format; if they type +233, keep international
    let formatted = value;
    if (!value.startsWith('+')) {
      formatted = formatGhanaPhoneNumber(value);
    }
    
    setPhoneNumber(formatted);
    setPhoneTouched(true);
    setPhoneError("");

    // Only validate phone if it's provided
    if (formatted && !validateGhanaPhoneNumber(formatted)) {
      setPhoneError("Please enter a valid Ghana phone number (024XXXXXXXX or +233XXXXXXXXX)");
    } else {
      setPhoneError("");
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPhoneError("");

    // Get password and email from form element directly to handle browser autofill
    const form = e.currentTarget as HTMLFormElement;
    const passwordInput = form.querySelector('#password') as HTMLInputElement;
    const emailInput = form.querySelector('#email') as HTMLInputElement;
    const actualPassword = passwordInput?.value || password || "";
    const actualEmail = emailInput?.value || email || "";
    
    // Validate required fields
    const trimmedEmail = (actualEmail || "").trim();
    const trimmedFullName = (fullName || "").trim();
    const trimmedPassword = actualPassword.trim();

    // Debug logging (can be removed in production)
    console.log("Form submission:", {
      email: trimmedEmail ? "***" : "empty",
      fullName: trimmedFullName ? "***" : "empty",
      password: trimmedPassword ? "***" : "empty",
      passwordLength: trimmedPassword.length,
      rawPassword: actualPassword ? "has value" : "no value",
      rawEmail: actualEmail ? "has value" : "no value",
      fromState: password ? "state" : "no state",
      fromDOM: passwordInput?.value ? "DOM" : "no DOM",
      emailFromState: email ? "state" : "no state",
      emailFromDOM: emailInput?.value ? "DOM" : "no DOM"
    });

    if (!trimmedEmail) {
      setError("Email is required");
      setLoading(false);
      return;
    }

    if (!trimmedFullName) {
      setError("Full name is required");
      setLoading(false);
      return;
    }

    if (!trimmedPassword || trimmedPassword.length === 0) {
      setError("Password is required");
      setLoading(false);
      return;
    }

    if (trimmedPassword.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address");
      setLoading(false);
      return;
    }

    // Validate phone only if provided
    if (phoneNumber.trim() && !validateGhanaPhoneNumber(phoneNumber)) {
      setPhoneError("Please enter a valid Ghana phone number (024XXXXXXXX or +233XXXXXXXXX)");
      setLoading(false);
      return;
    }

    try {
      // Prepare signup data - only include phone if provided
      const signupData: any = {
        email: trimmedEmail,
        password: trimmedPassword,
        options: {
          data: {
            full_name: trimmedFullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      };

      // Only add phone if provided
      if (phoneNumber.trim()) {
        signupData.phone = phoneNumber;
        signupData.options.data.phone = phoneNumber;
      }

      const { data, error: signupError } = await supabase.auth.signUp(signupData);

      if (signupError) {
        // Provide more specific error messages
        if (signupError.message.includes("fetch") || signupError.message.includes("network")) {
          throw new Error("Network error: Unable to connect to the server. Please check your internet connection and try again.");
        }
        throw signupError;
      }

      if (data.user) {
        // Update users table with phone number if provided
        if (data.user.id && phoneNumber.trim()) {
          // @ts-ignore - Supabase type inference issue with users table
          const { error: dbError } = await supabase
            .from("users")
            // @ts-ignore - Supabase type inference issue
            .update({ phone: phoneNumber })
            .eq("id", data.user.id);

          if (dbError) {
            console.error("Failed to update users table:", dbError);
          }
        }

        setSuccess(true);
      }
    } catch (err: any) {
      // Enhanced error handling with better messages
      let errorMessage = "Failed to sign up";
      
      if (err.message) {
        // Check for specific error types
        if (err.message.toLowerCase().includes("fetch") || 
            err.message.toLowerCase().includes("network") ||
            err.message.toLowerCase().includes("failed to fetch")) {
          errorMessage = "Network error: Unable to connect to the server. Please check your internet connection and try again. If the problem persists, the server may be temporarily unavailable.";
        } else if (err.message.toLowerCase().includes("user already registered") ||
                   err.message.toLowerCase().includes("already been registered") ||
                   err.message.toLowerCase().includes("email address has already") ||
                   err.message.toLowerCase().includes("email already exists")) {
          // Check for duplicate email errors first (before generic email check)
          errorMessage = "An account with this email already exists. Please sign in instead.";
        } else if (err.message.toLowerCase().includes("email")) {
          errorMessage = err.message;
        } else if (err.message.toLowerCase().includes("password")) {
          errorMessage = err.message;
        } else {
          errorMessage = err.message;
        }
      } else if (err instanceof TypeError) {
        errorMessage = "Network error: Unable to connect to the server. Please check your internet connection.";
      }
      
      console.error("Signup error details:", {
        error: err,
        message: err.message,
        name: err.name,
        stack: err.stack
      });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialError = (errorMessage: string) => {
    setError(errorMessage);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-herbal-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6 lg:p-8 text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
              <Mail className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold mb-2 text-primary-700 dark:text-primary-400">
            Check your email
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            We've sent you a confirmation link. Please check your email to verify your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-herbal-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6 lg:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2 text-primary-700 dark:text-primary-400">
          Create Account
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
          Join DanSarp Herbal Centre
        </p>

        <form onSubmit={handleEmailSignup} className="space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                // Clear any previous email errors when user types
                if (error && error.includes("email")) {
                  setError(null);
                }
              }}
              onInput={(e) => {
                // Fallback for autofill - update state when browser fills the field
                const target = e.target as HTMLInputElement;
                if (target.value !== email) {
                  setEmail(target.value);
                }
              }}
              onBlur={(e) => {
                // Ensure email is captured on blur
                if (e.target.value !== email) {
                  setEmail(e.target.value);
                }
              }}
              required
              autoComplete="email"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Phone Number <span className="text-gray-500 dark:text-gray-400 text-xs">(Optional)</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={handlePhoneChange}
                onBlur={() => setPhoneTouched(true)}
                maxLength={13}
                className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white ${
                  phoneError && phoneTouched
                    ? "border-red-500 dark:border-red-500"
                    : "border-gray-300 dark:border-gray-600"
                }`}
                placeholder="0244123456 or +233244123456"
              />
            </div>
            {phoneError && phoneTouched && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{phoneError}</p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Optional: Enter a Ghana phone number: 0244123456 or +233244123456
            </p>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                // Clear any previous password errors when user types
                if (error && error.includes("password")) {
                  setError(null);
                }
              }}
              onInput={(e) => {
                // Fallback for autofill - update state when browser fills the field
                const target = e.target as HTMLInputElement;
                if (target.value !== password) {
                  setPassword(target.value);
                }
              }}
              onBlur={(e) => {
                // Ensure password is captured on blur
                if (e.target.value !== password) {
                  setPassword(e.target.value);
                }
              }}
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
              placeholder="••••••••"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Must be at least 6 characters
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || (phoneTouched && phoneNumber.trim() !== "" && !validateGhanaPhoneNumber(phoneNumber))}
            className="w-full bg-primary-600 hover:bg-primary-950 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <SocialAuthButtons onError={handleSocialError} mode="signup" />

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{" "}
            <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
