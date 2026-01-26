"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Menu, X, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { UserMenu } from "./UserMenu";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Check initial auth state
    async function checkAuth() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      setUser(authUser);
      setLoading(false);
    }

    checkAuth();

    // Listen to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);


  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/treatments", label: "Treatments" },
    { href: "/gallery", label: "Gallery" },
    { href: "/testimonials", label: "Testimonials" },
    { href: "/blog", label: "Blog" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16">
          <Link href="/" className="flex items-center space-x-2 whitespace-nowrap mr-auto lg:mr-16 xl:mr-24 2xl:mr-32">
            <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              DanSarp
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">Herbal Centre</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8 lg:ml-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded px-2 py-1"
              >
                {link.label}
              </Link>
            ))}
            <ThemeToggle />
            <Link
              href="/appointments"
              className="bg-primary-600 hover:bg-primary-950 text-white px-4 py-2 rounded-lg transition-colors font-semibold whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 min-h-[40px] flex items-center"
            >
              Book Appointment
            </Link>
            {!loading && (
              <>
                {user ? (
                  <UserMenu />
                ) : (
                  <Link
                    href="/login"
                    className="bg-primary-600 hover:bg-primary-950 text-white px-4 py-2 rounded-lg transition-colors font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 min-h-[40px] flex items-center"
                  >
                    Login
                  </Link>
                )}
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              type="button"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-2 max-h-[calc(100vh-4rem)] overflow-y-auto" role="menu" aria-label="Mobile navigation">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors min-h-[44px] flex items-center"
                role="menuitem"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/appointments"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-3 bg-primary-600 text-white rounded-lg text-center font-semibold min-h-[44px] flex items-center justify-center transition-colors hover:bg-primary-700"
              role="menuitem"
            >
              Book Appointment
            </Link>
            {!loading && (
              <>
                {user ? (
                  <>
                    <Link
                      href="/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 bg-primary-600 text-white rounded-lg text-center font-semibold min-h-[44px] flex items-center justify-center transition-colors hover:bg-primary-700"
                      role="menuitem"
                    >
                      Dashboard
                    </Link>
                    <button
                      onClick={async () => {
                        await supabase.auth.signOut();
                        setUser(null);
                        setMobileMenuOpen(false);
                        router.push("/");
                        router.refresh();
                      }}
                      className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors font-semibold flex items-center justify-center gap-2 min-h-[44px]"
                      type="button"
                      aria-label="Logout"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-3 bg-primary-600 text-white rounded-lg text-center font-semibold min-h-[44px] flex items-center justify-center transition-colors hover:bg-primary-700"
                    role="menuitem"
                  >
                    Login
                  </Link>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
