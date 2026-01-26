"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  LayoutDashboard,
  Calendar,
  User,
  MessageSquare,
  CreditCard,
  Star,
  LogOut,
  Menu,
  X,
  Shield,
} from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { getUserRole, isAdmin, isUserOnly } from "@/lib/auth/rbac-client";
import { UserRole } from "@/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  userOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/appointments", label: "Appointments", icon: Calendar, userOnly: true },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/payments", label: "Payments", icon: CreditCard, userOnly: true },
  { href: "/my-reviews", label: "My Reviews", icon: Star, userOnly: true },
  { href: "/admin", label: "Admin Panel", icon: Shield, adminOnly: true },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkRole() {
      const role = await getUserRole();
      setUserRole(role);
      setLoading(false);
    }
    checkRole();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  // Filter nav items based on user role
  const filteredNavItems = navItems.filter((item) => {
    // Show admin-only items only to admins
    if (item.adminOnly) {
      return userRole && isAdmin(userRole);
    }
    // Hide user-only items from staff
    if (item.userOnly) {
      return userRole && isUserOnly(userRole);
    }
    // Show all other items to everyone
    return true;
  });

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileMenuOpen}
          type="button"
        >
          {isMobileMenuOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Brand */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <Link href="/" className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              DanSarp
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
            {!loading &&
              filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full transition-colors min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              type="button"
              aria-label="Logout"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
