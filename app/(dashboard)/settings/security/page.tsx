"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Copy,
  Download,
  AlertTriangle,
  Loader2,
} from "lucide-react";

export default function SecuritySettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function fetchUserData() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        router.push("/login");
        return;
      }

      try {
        const response = await fetch("/api/profile");
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          setTwoFactorEnabled(data.user?.two_factor_enabled || false);
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [router, supabase]);

  const handleGenerateSecret = async () => {
    setGenerating(true);
    setError(null);
    setSuccess(null);
    setQrCode(null);
    setSecret(null);

    try {
      const response = await fetch("/api/auth/2fa/generate", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate 2FA secret");
      }

      setQrCode(data.qrCode);
      setSecret(data.secret);
      setSuccess("2FA secret generated. Scan the QR code with your authenticator app.");
    } catch (err: any) {
      setError(err.message || "Failed to generate 2FA secret");
    } finally {
      setGenerating(false);
    }
  };

  const handleVerifyAndEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setError(null);
    setSuccess(null);

    if (!verificationCode || verificationCode.length !== 6) {
      setError("Please enter a valid 6-digit code");
      setVerifying(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: verificationCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to verify code");
      }

      setBackupCodes(data.backupCodes);
      setShowBackupCodes(true);
      setTwoFactorEnabled(true);
      setQrCode(null);
      setSecret(null);
      setVerificationCode("");
      setSuccess("2FA has been successfully enabled!");
    } catch (err: any) {
      setError(err.message || "Failed to verify code");
    } finally {
      setVerifying(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisabling(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: disableCode || undefined }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to disable 2FA");
      }

      setTwoFactorEnabled(false);
      setDisableCode("");
      setSuccess("2FA has been successfully disabled");
    } catch (err: any) {
      setError(err.message || "Failed to disable 2FA");
    } finally {
      setDisabling(false);
    }
  };

  const copyBackupCodes = () => {
    const codesText = backupCodes.join("\n");
    navigator.clipboard.writeText(codesText);
    setSuccess("Backup codes copied to clipboard!");
  };

  const downloadBackupCodes = () => {
    const codesText = backupCodes.join("\n");
    const blob = new Blob([codesText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dansarp-2fa-backup-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSuccess("Backup codes downloaded!");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Security Settings
            </h1>
          </div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage your account security and two-factor authentication
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg flex items-start gap-2">
            <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* 2FA Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                Two-Factor Authentication
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Add an extra layer of security to your account
              </p>
            </div>
            <div className="flex items-center gap-2">
              {twoFactorEnabled ? (
                <>
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    Enabled
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="w-6 h-6 text-gray-400" />
                  <span className="text-gray-500 dark:text-gray-400 font-medium">
                    Disabled
                  </span>
                </>
              )}
            </div>
          </div>

          {!twoFactorEnabled ? (
            /* Setup 2FA */
            <div className="space-y-4">
              {!qrCode ? (
                <button
                  onClick={handleGenerateSecret}
                  disabled={generating}
                  className="w-full sm:w-auto px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      Enable Two-Factor Authentication
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-6">
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                      Scan this QR code with your authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.):
                    </p>
                    <div className="flex justify-center mb-4">
                      {qrCode && (
                        <img
                          src={qrCode}
                          alt="2FA QR Code"
                          className="w-48 h-48 border-2 border-gray-300 dark:border-gray-600 rounded-lg"
                        />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                      Or enter this secret manually: <code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">{secret}</code>
                    </p>
                  </div>

                  <form onSubmit={handleVerifyAndEnable} className="space-y-4">
                    <div>
                      <label
                        htmlFor="verificationCode"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                      >
                        Enter 6-digit code from your authenticator app
                      </label>
                      <input
                        id="verificationCode"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(e) =>
                          setVerificationCode(e.target.value.replace(/\D/g, ""))
                        }
                        required
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white text-center text-2xl tracking-widest"
                        placeholder="000000"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={verifying || verificationCode.length !== 6}
                      className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        "Verify and Enable 2FA"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQrCode(null);
                        setSecret(null);
                        setVerificationCode("");
                      }}
                      className="w-full px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            /* Disable 2FA */
            <div className="space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium mb-1">
                      Disabling 2FA will reduce your account security
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400">
                      You can optionally enter a verification code or backup code to confirm this action.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleDisable} className="space-y-4">
                <div>
                  <label
                    htmlFor="disableCode"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Verification Code (Optional)
                  </label>
                  <input
                    id="disableCode"
                    type="text"
                    inputMode="numeric"
                    value={disableCode}
                    onChange={(e) =>
                      setDisableCode(e.target.value.replace(/\D/g, ""))
                    }
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter 6-digit code or backup code (optional)"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Optional: Enter your 2FA code or a backup code to confirm
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={disabling}
                  className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {disabling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Disabling...
                    </>
                  ) : (
                    "Disable Two-Factor Authentication"
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Backup Codes */}
        {showBackupCodes && backupCodes.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                  Backup Codes
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Save these codes in a safe place. You can use them to access your account if you lose your authenticator device.
                </p>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((code, index) => (
                  <div
                    key={index}
                    className="p-2 bg-white dark:bg-gray-600 rounded text-center"
                  >
                    {code}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={copyBackupCodes}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copy Codes
              </button>
              <button
                onClick={downloadBackupCodes}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={() => setShowBackupCodes(false)}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              >
                I've Saved These Codes
              </button>
            </div>
          </div>
        )}

        {/* Security Tips */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-3">
            Security Tips
          </h3>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-400">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Use a reputable authenticator app (Google Authenticator, Authy, Microsoft Authenticator)</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Store backup codes in a secure password manager or safe location</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Each backup code can only be used once</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>If you lose your device, use a backup code to disable 2FA and set it up again</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
