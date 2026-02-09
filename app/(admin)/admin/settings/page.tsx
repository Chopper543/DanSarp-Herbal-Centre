"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toaster";

type OrgProfile = {
  mission: string;
  vision: string;
  values: string;
  team_members: any[];
  certifications: any[];
};

const emptyProfile: OrgProfile = {
  mission: "",
  vision: "",
  values: "",
  team_members: [],
  certifications: [],
};

export default function AdminSettingsPage() {
  const [profile, setProfile] = useState<OrgProfile>(emptyProfile);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const res = await fetch("/api/organization");
        if (!res.ok) {
          throw new Error("Failed to load organization profile");
        }
        const data = await res.json();
        setProfile(data.profile || emptyProfile);
      } catch (error: any) {
        toast({
          title: "Could not load settings",
          description: error?.message || "Please try again.",
          variant: "error",
        });
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result?.error || "Failed to save settings");
      }

      setProfile(result.profile || profile);
      toast({
        title: "Settings updated",
        description: "Organization profile saved successfully.",
        variant: "success",
      });
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error?.message || "Please try again.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage organization profile and integration readiness.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Organization Profile
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Mission, vision, and core values shown across the site.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Mission
              </label>
              <textarea
                value={profile.mission}
                onChange={(e) => setProfile({ ...profile, mission: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Our mission is to..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Vision
              </label>
              <textarea
                value={profile.vision}
                onChange={(e) => setProfile({ ...profile, vision: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Our vision is to..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Values
              </label>
              <textarea
                value={profile.values}
                onChange={(e) => setProfile({ ...profile, values: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Safety, empathy, evidence-based care..."
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Team Members (JSON array)
                </label>
                <textarea
                  value={JSON.stringify(profile.team_members ?? [], null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value || "[]");
                      setProfile({ ...profile, team_members: parsed });
                    } catch {
                      // ignore parse errors until save
                    }
                  }}
                  rows={6}
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder='[{"name":"Dr. A","role":"Medical Director","bio":"..."}]'
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Certifications (JSON array)
                </label>
                <textarea
                  value={JSON.stringify(profile.certifications ?? [], null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value || "[]");
                      setProfile({ ...profile, certifications: parsed });
                    } catch {
                      // ignore parse errors until save
                    }
                  }}
                  rows={6}
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder='[{"name":"Certification","issuer":"Org","issue_date":"2024-01-01"}]'
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="px-5 py-2 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Integration Checklist
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Quick reminders for production readiness.
            </p>
            <ul className="space-y-2 text-sm text-gray-800 dark:text-gray-200">
              <li>• Resend API key configured</li>
              <li>• Paystack / Flutterwave keys configured</li>
              <li>• UPSTASH_REDIS_REST_URL / TOKEN set for rate limiting</li>
              <li>• TWO_FA_ENC_KEY set (2FA encryption)</li>
              <li>• CRON_SECRET set for scheduled tasks</li>
            </ul>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              These values are validated at runtime by env validation scripts.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Support Contacts
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Ensure support email/phone are present in Organization Profile and Navbar.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Edit footer/social links in `components/features/Footer.tsx` if needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
