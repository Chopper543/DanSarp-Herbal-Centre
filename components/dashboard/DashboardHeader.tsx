"use client";

import { ProfileAvatar } from "./ProfileAvatar";
import Link from "next/link";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserRole, isSuperAdmin } from "@/lib/auth/rbac-client";
import { UserRole } from "@/types";

export function DashboardHeader() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        setUser(authUser);

        // Fetch user role
        const role = await getUserRole();
        setUserRole(role);

        // Fetch user profile
        const response = await fetch("/api/profile");
        if (response.ok) {
          const data = await response.json();
          setProfile(data.profile);
        }
      }
    }

    fetchData();
  }, []);

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side - could add search or breadcrumbs */}
          <div className="flex-1"></div>

          {/* Right side - notifications and profile */}
          <div className="flex items-center gap-4">
            <NotificationBell />

            {/* Profile */}
            <div className="flex items-center gap-3">
              <Link href="/profile">
                <ProfileAvatar
                  avatarUrl={profile?.avatar_url}
                  name={user?.user_metadata?.full_name || profile?.full_name}
                  size="sm"
                />
              </Link>
              <div className="hidden md:block">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.user_metadata?.full_name || "User"}
                  </p>
                  {userRole && isSuperAdmin(userRole) && (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                      Super Admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
