"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUserRole, isClinicalStaff, isSuperAdmin } from "@/lib/auth/rbac-client";
import { canAccessSection } from "@/lib/auth/role-capabilities";
import type { AdminSection } from "@/lib/auth/role-capabilities";
import { UserRole } from "@/types";
import { ChevronDown, Menu, X } from "lucide-react";

const ADMIN_NAV: { section: AdminSection; href: string; label: string }[] = [
  { section: "dashboard", href: "/admin", label: "Dashboard" },
  { section: "appointments", href: "/admin/appointments", label: "Appointments" },
  { section: "content", href: "/admin/content", label: "Content" },
  { section: "payments", href: "/admin/payments", label: "Payments" },
  { section: "users", href: "/admin/users", label: "Users" },
  { section: "patient_records", href: "/admin/patient-records", label: "Patient Records" },
  { section: "newsletter", href: "/admin/newsletter", label: "Newsletter" },
  { section: "messages", href: "/admin/messages", label: "Messages" },
  { section: "prescriptions", href: "/admin/prescriptions", label: "Prescriptions" },
  { section: "lab_results", href: "/admin/lab-results", label: "Lab Results" },
  { section: "clinical_notes", href: "/admin/clinical-notes", label: "Clinical Notes" },
  { section: "intake_forms", href: "/admin/intake-forms", label: "Intake Forms" },
  { section: "admins", href: "/admin/admins", label: "Admin Management" },
  { section: "invites", href: "/admin/invites", label: "Admin Invites" },
  { section: "audit_logs", href: "/admin/audit-logs", label: "Audit Logs" },
  { section: "database", href: "/admin/database", label: "Database Tools" },
  { section: "system", href: "/admin/system", label: "System Settings" },
];

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
  const [superAdminMenuOpen, setSuperAdminMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      if (!isClinicalStaff(role)) {
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

  const navItems = ADMIN_NAV.filter((item) =>
    canAccessSection(userRole, item.section)
  );
  const isUserSuperAdmin = userRole && isSuperAdmin(userRole);
  const superAdminOnlySections: AdminSection[] = [
    "admins",
    "invites",
    "audit_logs",
    "database",
    "system",
  ];
  const mainNavItems = navItems.filter(
    (item) => !superAdminOnlySections.includes(item.section)
  );
  const superAdminItems = navItems.filter((item) =>
    superAdminOnlySections.includes(item.section)
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left side - Logo and main nav */}
            <div className="flex items-center space-x-6 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Link href="/admin" className="text-xl font-bold text-primary-600 dark:text-primary-400 truncate">
                  Admin Panel
                </Link>
                {isUserSuperAdmin && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                    Super Admin
                  </span>
                )}
              </div>
              
              {/* Desktop Navigation */}
              <div className="hidden lg:flex items-center space-x-4">
                {mainNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-sm text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors whitespace-nowrap"
                  >
                    {item.label}
                  </Link>
                ))}
                
                {/* Super Admin Dropdown */}
                {isUserSuperAdmin && (
                  <div className="relative">
                    <button
                      onClick={() => setSuperAdminMenuOpen(!superAdminMenuOpen)}
                      className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      <span>More</span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${superAdminMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {superAdminMenuOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setSuperAdminMenuOpen(false)}
                        />
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                          {superAdminItems.map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setSuperAdminMenuOpen(false)}
                              className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right side - Back to Site and Mobile Menu */}
            <div className="flex items-center gap-4">
              <Link 
                href="/" 
                className="hidden sm:block text-sm text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                Back to Site
              </Link>
              
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-gray-200 dark:border-gray-700 py-4 max-h-[calc(100vh-5rem)] overflow-y-auto">
              <div className="space-y-1">
                {mainNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
                {isUserSuperAdmin && (
                  <>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Super Admin
                    </div>
                    {superAdminItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors pl-8"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </>
                )}
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Back to Site
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
