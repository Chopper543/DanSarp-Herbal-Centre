"use client";

/**
 * Forced-enrollment landing page. Staff users (super_admin, admin, doctor,
 * nurse, content_manager, appointment_manager, finance_manager) hit this page
 * after password login if they have not yet enrolled in 2FA — the middleware
 * (lib/proxy.ts) refuses to let them touch any other surface until enrollment
 * completes. The page reuses the existing /api/auth/2fa/generate and /verify
 * endpoints; the only thing different from the in-settings flow is tone:
 * this is a hard gate, not an optional security upgrade.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ShieldAlert, ShieldCheck, AlertTriangle, Loader2, Copy, Download } from "lucide-react";

export default function ForceSetup2FAPage() {
  const router = useRouter();
  const [step, setStep] = useState<"intro" | "qr" | "done">("intro");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  useEffect(() => {
    // The CSRF token is rendered into a meta tag by the root layout.
    const meta = document.querySelector('meta[name="x-csrf-token"]') as HTMLMetaElement | null;
    setCsrfToken(meta?.content || null);
  }, []);

  const headers = (): HeadersInit => ({
    "Content-Type": "application/json",
    ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
  });

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/generate", { method: "POST", headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate 2FA secret");
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep("qr");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify code");
      setBackupCodes(data.backupCodes || []);
      setStep("done");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function copyCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n"));
  }

  function downloadCodes() {
    const blob = new Blob([backupCodes.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dansarp-2fa-backup-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12" role="main">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          {step === "done" ? (
            <ShieldCheck className="w-8 h-8 text-green-600" />
          ) : (
            <ShieldAlert className="w-8 h-8 text-amber-600" />
          )}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {step === "done" ? "2FA enabled" : "Two-factor required"}
          </h1>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md flex items-start gap-2" role="alert">
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === "intro" && (
          <>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Your role requires two-factor authentication. Set up an authenticator
              app (Google Authenticator, Authy, 1Password) to continue.
            </p>
            <button
              type="button"
              onClick={generate}
              disabled={busy}
              className="w-full inline-flex justify-center items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Start 2FA setup
            </button>
          </>
        )}

        {step === "qr" && qrCode && (
          <form onSubmit={verify} className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Scan this QR code in your authenticator app, then enter the 6-digit code it shows.
            </p>
            <div className="flex justify-center bg-white p-3 rounded-md border">
              <Image src={qrCode} alt="2FA QR code" width={192} height={192} unoptimized />
            </div>
            {secret && (
              <p className="text-xs text-gray-500 dark:text-gray-400 break-all">
                Manual entry secret: <code>{secret}</code>
              </p>
            )}
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full text-center tracking-widest text-xl py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex justify-center items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Verify and enable
            </button>
          </form>
        )}

        {step === "done" && (
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              Save these single-use backup codes somewhere safe. They can be used if
              you lose access to your authenticator.
            </p>
            <ul className="grid grid-cols-2 gap-2 font-mono text-sm bg-gray-50 dark:bg-gray-900 rounded-md p-3">
              {backupCodes.map((c) => (
                <li key={c} className="text-gray-900 dark:text-white">{c}</li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button type="button" onClick={copyCodes} className="flex-1 inline-flex justify-center items-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white py-2 px-4 rounded-md">
                <Copy className="w-4 h-4" /> Copy
              </button>
              <button type="button" onClick={downloadCodes} className="flex-1 inline-flex justify-center items-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white py-2 px-4 rounded-md">
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
            <button
              type="button"
              onClick={() => router.replace("/dashboard")}
              className="w-full inline-flex justify-center items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-md"
            >
              Continue to dashboard
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
