"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserRole, isSuperAdmin } from "@/lib/auth/rbac-client";
import { UserRole } from "@/types";
import { Database, DollarSign, Users, FileText, Activity } from "lucide-react";

export default function SystemSettingsPage() {
  const [stats, setStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const role = await getUserRole();
      setUserRole(role);

      if (!isSuperAdmin(role)) {
        router.push("/admin");
        return;
      }

      fetchStats();
    }

    checkAuth();
  }, []);

  async function fetchStats() {
    try {
      const response = await fetch("/api/admin/system");
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats || {});
      }
    } catch (error) {
      console.error("Failed to fetch system stats:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!userRole || !isSuperAdmin(userRole)) {
    return null;
  }

  const statCards = [
    {
      title: "Total Users",
      value: stats.users || 0,
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Total Revenue",
      value: `GHS ${(stats.revenue || 0).toFixed(2)}`,
      icon: DollarSign,
      color: "text-green-600 dark:text-green-400",
    },
    {
      title: "Total Appointments",
      value: stats.appointments || 0,
      icon: FileText,
      color: "text-purple-600 dark:text-purple-400",
    },
    {
      title: "Recent Audit Logs (24h)",
      value: stats.recent_audit_logs || 0,
      icon: Activity,
      color: "text-orange-600 dark:text-orange-400",
    },
  ];

  const tableStats = [
    { name: "Users", count: stats.users },
    { name: "Profiles", count: stats.profiles },
    { name: "Appointments", count: stats.appointments },
    { name: "Payments", count: stats.payments },
    { name: "Reviews", count: stats.reviews },
    { name: "Messages", count: stats.messages },
    { name: "Blog Posts", count: stats.blog_posts },
    { name: "Newsletter Subscribers", count: stats.newsletter_subscribers },
    { name: "Gallery Items", count: stats.gallery_items },
    { name: "Testimonials", count: stats.testimonials },
    { name: "Branches", count: stats.branches },
    { name: "Treatments", count: stats.treatments },
    { name: "Admin Invites", count: stats.admin_invites },
    { name: "Audit Logs", count: stats.audit_logs },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Database className="w-8 h-8 text-primary-600 dark:text-primary-400" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          System Settings
        </h1>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {card.title}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    {card.value}
                  </p>
                </div>
                <Icon className={`w-8 h-8 ${card.color}`} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Database Statistics
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tableStats.map((table, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {table.name}
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {table.count !== null && table.count !== undefined
                    ? table.count.toLocaleString()
                    : "N/A"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          System Information
        </h2>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p>
            <span className="font-medium">Database:</span> Supabase PostgreSQL
          </p>
          <p>
            <span className="font-medium">RLS Status:</span> Enabled on all
            tables
          </p>
          <p>
            <span className="font-medium">Super Admin Access:</span> Full
            database access with RLS bypass
          </p>
        </div>
      </div>
    </div>
  );
}
