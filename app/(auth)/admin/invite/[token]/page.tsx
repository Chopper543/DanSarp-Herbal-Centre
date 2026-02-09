"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminInviteAcceptPage({ params }: { params: any }) {
  const router = useRouter();
  const { token } = params || {};

  const [status, setStatus] = useState<"idle" | "accepting" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const acceptInvite = async () => {
    setStatus("accepting");
    setMessage(null);

    try {
      const response = await fetch("/api/admin/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to accept invite");
      }

      setStatus("success");
      setMessage("Invitation accepted. Redirecting to admin dashboard...");
      // Give users a moment to read the message before redirecting
      setTimeout(() => router.push("/admin"), 1200);
    } catch (error: any) {
      setStatus("error");
      setMessage(error?.message || "Unable to accept invite. Please try again.");
    }
  };

  const appName = "DanSarp Herbal Centre";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Admin invitation</p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              Accept your invite
            </h1>
          </div>
          <span className="text-sm font-semibold text-primary-700 dark:text-primary-400">
            {appName}
          </span>
        </div>

        <p className="text-gray-700 dark:text-gray-300 mb-4">
          You’ve been invited to join the admin workspace. You must be signed in to accept this
          invitation. If you don’t have an account yet, sign up with this email first, then return
          to this page to accept.
        </p>

        {message && (
          <div
            className={`mb-4 rounded-lg px-4 py-3 text-sm ${
              status === "success"
                ? "bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-200 dark:border-green-800"
                : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800"
            }`}
          >
            {message}
          </div>
        )}

        <button
          onClick={acceptInvite}
          disabled={status === "accepting"}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary-600 hover:bg-primary-950 text-white font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {status === "accepting" ? "Accepting invite..." : "Accept invitation"}
        </button>

        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <Link
            href="/login"
            className="text-primary-700 hover:text-primary-900 dark:text-primary-300 dark:hover:text-primary-200 font-medium text-center"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white text-center"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
