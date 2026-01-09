"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
      }
    }

    checkAuth();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="text-xl font-bold text-primary-600 dark:text-primary-400">
                Dashboard
              </Link>
              <Link href="/appointments" className="text-gray-700 dark:text-gray-300 hover:text-primary-600">
                Appointments
              </Link>
            </div>
            <Link href="/" className="text-gray-700 dark:text-gray-300 hover:text-primary-600">
              Back to Home
            </Link>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
