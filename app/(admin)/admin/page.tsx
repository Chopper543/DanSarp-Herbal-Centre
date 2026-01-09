"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    appointments: 0,
    users: 0,
    payments: 0,
    revenue: 0,
  });
  const supabase = createClient();

  useEffect(() => {
    async function fetchStats() {
      const [appointmentsRes, usersRes, paymentsRes] = await Promise.all([
        supabase.from("appointments").select("id", { count: "exact" }),
        supabase.from("users").select("id", { count: "exact" }),
        supabase.from("payments").select("id, amount", { count: "exact" }),
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
      });
    }

    fetchStats();
  }, []);

  const statCards = [
    { label: "Total Appointments", value: stats.appointments, href: "/admin/appointments" },
    { label: "Total Users", value: stats.users, href: "/admin/users" },
    { label: "Total Payments", value: stats.payments, href: "/admin/payments" },
    { label: "Total Revenue", value: `GHS ${stats.revenue.toFixed(2)}`, href: "/admin/payments" },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
        Admin Dashboard
      </h1>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card, index) => (
          <Link key={index} href={card.href}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                {card.label}
              </h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {card.value}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Quick Actions
          </h2>
          <div className="space-y-2">
            <Link
              href="/admin/appointments"
              className="block w-full text-left px-4 py-2 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30"
            >
              Manage Appointments
            </Link>
            <Link
              href="/admin/content"
              className="block w-full text-left px-4 py-2 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30"
            >
              Manage Content
            </Link>
            <Link
              href="/admin/users"
              className="block w-full text-left px-4 py-2 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30"
            >
              Manage Users
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Recent Activity
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Activity feed will be displayed here
          </p>
        </div>
      </div>
    </div>
  );
}
