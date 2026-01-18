"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PhoneOtpVerification } from "@/components/auth/PhoneOtpVerification";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { validateGhanaPhoneNumber, formatGhanaPhoneNumber } from "@/lib/payments/validation";
import { formatPhoneForSupabase } from "@/lib/utils/phone-format";
import { Phone, Mail, AlertCircle } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<"phone" | "email">("email");
  const [otpSent, setOtpSent] = useState(false);
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

    if (formatted && !validateGhanaPhoneNumber(formatted)) {
      setPhoneError("Please enter a valid Ghana phone number (024XXXXXXXX or +233XXXXXXXXX)");
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateGhanaPhoneNumber(phoneNumber)) {
      setPhoneError("Please enter a valid Ghana phone number (024XXXXXXXX or +233XXXXXXXXX)");
      return;
    }

    if (!fullName || !email || !password) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError(null);
    setPhoneError("");

    try {
      // Store signup data in sessionStorage for after OTP verification
      sessionStorage.setItem("pendingSignup", JSON.stringify({
        email,
        password,
        fullName,
        phoneNumber,
      }));

      // Convert phone to international format for Supabase
      const internationalPhone = formatPhoneForSupabase(phoneNumber, true); // Enable debug logging

      // Debug logging
      console.log("Phone OTP Request:", {
        localFormat: phoneNumber,
        internationalFormat: internationalPhone,
        isValidE164: internationalPhone.startsWith('+') && /^\+233(24|20|27)\d{7}$/.test(internationalPhone)
      });

      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: internationalPhone,
        options: {
          channel: "sms",
          data: {
            full_name: fullName,
            email: email,
          },
        },
      });

      if (otpError) {
        console.error("Supabase OTP Error:", {
          error: otpError,
          message: otpError.message,
          localFormat: phoneNumber,
          internationalFormat: internationalPhone
        });
        throw otpError;
      }

      console.log("OTP sent successfully to:", internationalPhone);
      setOtpSent(true);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to send verification code";
      
      // Check for specific Supabase errors
      if (errorMessage.includes("Unsupported phone provider") || 
          errorMessage.includes("phone provider") ||
          errorMessage.toLowerCase().includes("provider")) {
        setError(
          "Phone authentication is not configured. Please ensure:\n\n" +
          "1. Phone auth is enabled in Supabase Dashboard → Authentication → Providers → Phone\n" +
          "2. SMS provider (Twilio/Vonage) is configured in Supabase\n" +
          "3. Phone number format is correct (+233XXXXXXXXX)\n\n" +
          "If you're the administrator, check your Supabase project settings."
        );
      } else {
        setError(errorMessage);
      }
      
      // Debug logging
      console.error("Phone OTP Error:", {
        localFormat: phoneNumber,
        internationalFormat: formatPhoneForSupabase(phoneNumber, false),
        error: err,
        errorMessage: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneVerified = async () => {
    // After phone OTP verification, update user with email and password
    setLoading(true);
    setError(null);

    try {
      // Get stored signup data
      const storedData = sessionStorage.getItem("pendingSignup");
      if (!storedData) {
        throw new Error("Signup data not found");
      }

      const { email: storedEmail, password: storedPassword, fullName: storedFullName } = JSON.parse(storedData);

      // Get the current user (created by OTP verification)
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("User not found after verification");
      }

      // Update user with email and password
      const { error: updateError } = await supabase.auth.updateUser({
        email: storedEmail,
        password: storedPassword,
        data: {
          full_name: storedFullName,
          phone: phoneNumber,
        },
      });

      if (updateError) throw updateError;

      // Update users table
      // @ts-ignore - Supabase type inference issue with users table
      const { error: dbError } = await supabase
        .from("users")
        // @ts-ignore - Supabase type inference issue
        .update({ 
          phone: phoneNumber, 
          full_name: storedFullName,
          email: storedEmail,
        })
        .eq("id", user.id);

      if (dbError) {
        console.error("Failed to update users table:", dbError);
        // Don't throw - user is already created
      }

      // Clear stored data
      sessionStorage.removeItem("pendingSignup");

      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to complete signup");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!validateGhanaPhoneNumber(phoneNumber)) {
      setPhoneError("Please enter a valid 10-digit Ghana phone number");
      setLoading(false);
      return;
    }

    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        phone: phoneNumber,
        options: {
          data: {
            full_name: fullName,
            phone: phoneNumber,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signupError) throw signupError;

      if (data.user) {
        // Update users table with phone number
        if (data.user.id) {
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
      setError(err.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialError = (errorMessage: string) => {
    setError(errorMessage);
  };

  if (success && verificationMethod === "email") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-herbal-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
              <Mail className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-2 text-primary-700 dark:text-primary-400">
            Check your email
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            We've sent you a confirmation link. Please check your email to verify your account.
          </p>
        </div>
      </div>
    );
  }

  if (otpSent && verificationMethod === "phone") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-herbal-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-center mb-2 text-primary-700 dark:text-primary-400">
            Verify Phone Number
          </h1>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
            Enter the verification code sent to your phone
          </p>

          <PhoneOtpVerification
            phoneNumber={phoneNumber}
            onVerified={handlePhoneVerified}
            onError={setError}
          />

          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setOtpSent(false);
                setError(null);
              }}
              className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
            >
              Change phone number
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-herbal-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center mb-2 text-primary-700 dark:text-primary-400">
          Create Account
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
          Join DanSarp Herbal Centre
        </p>

        <form onSubmit={verificationMethod === "email" ? handleEmailSignup : handleSendOtp} className="space-y-6">
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
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
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
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Phone Number <span className="text-red-500">*</span>
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
                required
                className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white ${
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
              Enter a Ghana phone number: 0244123456 or +233244123456
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
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="••••••••"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Must be at least 6 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Verification Method
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <input
                  type="radio"
                  name="verificationMethod"
                  value="email"
                  checked={verificationMethod === "email"}
                  onChange={(e) => setVerificationMethod(e.target.value as "email" | "phone")}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                />
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Email Verification</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Verify via email link</p>
                  </div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <input
                  type="radio"
                  name="verificationMethod"
                  value="phone"
                  checked={verificationMethod === "phone"}
                  onChange={(e) => setVerificationMethod(e.target.value as "email" | "phone")}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                />
                <div className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Phone OTP</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Verify via SMS code</p>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || (phoneTouched && !validateGhanaPhoneNumber(phoneNumber))}
            className="w-full bg-primary-600 hover:bg-primary-950 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? verificationMethod === "phone"
                ? "Sending code..."
                : "Creating account..."
              : verificationMethod === "phone"
              ? "Send Verification Code"
              : "Sign Up"}
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
