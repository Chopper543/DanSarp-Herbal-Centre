"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Calendar, Users, DollarSign, Building2, Mail, Activity, Clock } from "lucide-react";

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  created_at: string;
  user?: {
    id: string;
    email: string;
    full_name: string | null;
  };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    appointments: 0,
    users: 0,
    payments: 0,
    revenue: 0,
    branches: 0,
    subscribers: 0,
  });
  const [recentActivity, setRecentActivity] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      const [appointmentsRes, usersRes, paymentsRes, branchesRes, subscribersRes] = await Promise.all([
        supabase.from("appointments").select("id", { count: "exact" }),
        supabase.from("users").select("id", { count: "exact" }),
        supabase.from("payments").select("id, amount", { count: "exact" }),
        supabase.from("branches").select("id", { count: "exact" }),
        supabase.from("newsletter_subscribers").select("id", { count: "exact" }),
      ]);

      // @ts-ignore - Supabase type inference issue with payments table
      const revenue = (paymentsRes.data as Array<{ amount: number }> | null)
        ?.filter((p) => p.amount)
        .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0) || 0;

      setStats({
        appointments: appointmentsRes.count || 0,
        users: usersRes.count || 0,
        payments: paymentsRes.count || 0,
        revenue,
        branches: branchesRes.count || 0,
        subscribers: subscribersRes.count || 0,
      });

      // Fetch recent activity
      try {
        const activityRes = await fetch("/api/admin/audit-logs?limit=10");
        if (activityRes.ok) {
          const activityData = await activityRes.json();
          setRecentActivity(activityData.logs || []);
        }
      } catch (error) {
        console.error("Failed to fetch activity:", error);
      }

      setLoading(false);
    }

    fetchData();
  }, []);

  const statCards = [
    { label: "Total Appointments", value: stats.appointments, href: "/admin/appointments", icon: Calendar },
    { label: "Total Users", value: stats.users, href: "/admin/users", icon: Users },
    { label: "Total Payments", value: stats.payments, href: "/admin/payments", icon: DollarSign },
    { label: "Total Revenue", value: `GHS ${stats.revenue.toFixed(2)}`, href: "/admin/payments", icon: DollarSign },
    { label: "Branches", value: stats.branches, href: "/admin/content/branches", icon: Building2 },
    { label: "Newsletter Subscribers", value: stats.subscribers, href: "/admin/newsletter", icon: Mail },
  ];

  const formatActivityAction = (log: AuditLog) => {
    const user = log.user?.full_name || log.user?.email || "System";
    const action = log.action.replace(/_/g, " ").toLowerCase();
    const resource = log.resource_type.replace(/_/g, " ").toLowerCase();
    return `${user} ${action} ${resource}`;
  };

  const getActivityIcon = (action: string) => {
    if (action.includes("create") || action.includes("insert")) return "➕";
    if (action.includes("update") || action.includes("edit")) return "✏️";
    if (action.includes("delete") || action.includes("remove")) return "🗑️";
    return "📝";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
        Admin Dashboard
      </h1>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {statCards.map((card, index) => (
          <Link key={index} href={card.href}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    {card.label}
                  </h3>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {card.value}
                  </p>
                </div>
                <card.icon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Quick Actions
          </h2>
          <div className="space-y-2">
            <Link
              href="/admin/appointments"
              className="block w-full text-left px-4 py-2 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
            >
              Manage Appointments
            </Link>
            <Link
              href="/admin/content"
              className="block w-full text-left px-4 py-2 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
            >
              Manage Content
            </Link>
            <Link
              href="/admin/users"
              className="block w-full text-left px-4 py-2 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
            >
              Manage Users
            </Link>
            <Link
              href="/admin/patient-records"
              className="block w-full text-left px-4 py-2 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
            >
              Patient Records
            </Link>
            <Link
              href="/admin/messages"
              className="block w-full text-left px-4 py-2 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
            >
              View Messages
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Activity
          </h2>
          {recentActivity.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400">No recent activity to display.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recentActivity.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <span className="text-lg">{getActivityIcon(log.action)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white font-medium">
                      {formatActivityAction(log)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
