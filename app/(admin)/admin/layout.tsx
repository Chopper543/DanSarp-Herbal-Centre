"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUserRole, isAdmin, isSuperAdmin } from "@/lib/auth/rbac-client";
import { UserRole } from "@/types";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const role = await getUserRole();
      if (!isAdmin(role)) {
        router.push("/dashboard");
        return;
      }

      setUserRole(role);
      setAuthorized(true);
      setLoading(false);
    }

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  const navItems = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/appointments", label: "Appointments" },
    { href: "/admin/content", label: "Content" },
    { href: "/admin/payments", label: "Payments" },
    { href: "/admin/users", label: "Users" },
    // Super admin only items
    ...(userRole && isSuperAdmin(userRole)
      ? [
          { href: "/admin/admins", label: "Admin Management" },
          { href: "/admin/system", label: "System Settings" },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center gap-2">
                <Link href="/admin" className="text-xl font-bold text-primary-600 dark:text-primary-400">
                  Admin Panel
                </Link>
                {userRole && isSuperAdmin(userRole) && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                    Super Admin
                  </span>
                )}
              </div>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <Link href="/" className="text-gray-700 dark:text-gray-300 hover:text-primary-600">
              Back to Site
            </Link>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
