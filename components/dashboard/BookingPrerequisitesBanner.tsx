"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Mail, User, Phone, ClipboardList, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type MissingItem = "email_verification" | "full_name" | "phone" | "required_intake_forms";

interface PrereqApiResponse {
  emailVerified: boolean;
  profileComplete: { fullName: boolean; phone: boolean };
  missingRequiredForms: Array<{ id: string; name: string }>;
  missing: MissingItem[];
  canProceed: boolean;
}

export function BookingPrerequisitesBanner() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PrereqApiResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/booking/prerequisites");
        const json = (await res.json()) as PrereqApiResponse;
        if (res.ok) {
          setData(json);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const needsAttention = useMemo(() => {
    return Boolean(data && !data.canProceed);
  }, [data]);

  const resendEmail = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) {
        alert("No email found for this account.");
        return;
      }
      const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
      if (error) throw error;
      alert("Verification email sent! Please check your inbox.");
    } catch (err: any) {
      alert("Failed to send verification email: " + (err?.message || "Unknown error"));
    }
  };

  const renderItem = (
    ok: boolean,
    label: string,
    Icon: React.ComponentType<{ className?: string }>,
    cta?: React.ReactNode
  ) => {
    return (
      <div className="flex items-start gap-3">
        {ok ? (
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
        ) : (
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
          </div>
          {!ok && cta && <div className="mt-2">{cta}</div>}
        </div>
      </div>
    );
  };

  if (loading || dismissed) return null;
  if (!data) return null;
  if (!needsAttention) return null;

  const missingFormsText =
    data.missingRequiredForms?.length > 0
      ? data.missingRequiredForms.map((f) => f.name).join(", ")
      : "";

  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-800 dark:text-red-300 mb-1">
              Before you can book an appointment
            </h3>
            <p className="text-sm text-red-700 dark:text-red-400 mb-4">
              Please complete the required steps below. Booking and payment are blocked until these are done.
            </p>

            <div className="space-y-4">
              {renderItem(
                data.emailVerified,
                "Verify your email",
                Mail,
                <button
                  type="button"
                  onClick={resendEmail}
                  className="text-sm px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Resend verification email
                </button>
              )}

              {renderItem(
                data.profileComplete.fullName,
                "Add your full name",
                User,
                <Link
                  href="/profile/edit"
                  className="inline-block text-sm px-4 py-2 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100/40 dark:hover:bg-red-900/30 transition-colors"
                >
                  Edit profile
                </Link>
              )}

              {renderItem(
                data.profileComplete.phone,
                "Add your phone number",
                Phone,
                <Link
                  href="/profile/edit"
                  className="inline-block text-sm px-4 py-2 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100/40 dark:hover:bg-red-900/30 transition-colors"
                >
                  Edit profile
                </Link>
              )}

              {renderItem(
                data.missingRequiredForms.length === 0,
                "Complete required intake forms",
                ClipboardList,
                <div className="space-y-2">
                  {missingFormsText && (
                    <div className="text-sm text-red-700 dark:text-red-400">
                      Missing: <span className="font-medium">{missingFormsText}</span>
                    </div>
                  )}
                  <Link
                    href="/intake-forms"
                    className="inline-block text-sm px-4 py-2 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100/40 dark:hover:bg-red-900/30 transition-colors"
                  >
                    Go to intake forms
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

