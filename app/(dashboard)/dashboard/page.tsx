"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { QuickActionButton } from "@/components/dashboard/QuickActionButton";
import { UpcomingAppointmentsWidget } from "@/components/dashboard/UpcomingAppointmentsWidget";
import { PaymentSummaryWidget } from "@/components/dashboard/PaymentSummaryWidget";
import { UserRatingDisplay } from "@/components/dashboard/UserRatingDisplay";
import { EmailVerificationBanner } from "@/components/dashboard/EmailVerificationBanner";
import { Calendar, PlusCircle, FileText, MessageSquare, Shield } from "lucide-react";
import { calculateUserRatingClient } from "@/lib/utils/calculate-user-rating-client";
import { getUserRole, isAdmin, isSuperAdmin } from "@/lib/auth/rbac-client";
import { UserRole } from "@/types";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    upcoming: 0,
    completed: 0,
  });
  const [rating, setRating] = useState({ averageRating: 0, totalReviews: 0 });
  const [loading, setLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        router.push("/login");
        return;
      }

      setUser(authUser);
      setEmailVerified(authUser.email_confirmed_at !== null);

      // Fetch user role
      const role = await getUserRole();
      setUserRole(role);

      // Fetch profile
      try {
        const profileResponse = await fetch("/api/profile");
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          setProfile(profileData.profile);
          if (profileData.user?.email_verified) {
            setEmailVerified(true);
          }
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      }

      // Fetch appointments
      try {
        const appointmentsResponse = await fetch("/api/appointments");
        if (appointmentsResponse.ok) {
          const appointmentsData = await appointmentsResponse.json();
          const allAppointments = appointmentsData.appointments || [];
          setAppointments(allAppointments);

          const now = new Date();
          const total = allAppointments.length;
          const upcoming = allAppointments.filter((apt: any) => {
            const aptDate = new Date(apt.appointment_date);
            return aptDate >= now && apt.status !== "cancelled";
          }).length;
          const completed = allAppointments.filter(
            (apt: any) => apt.status === "completed"
          ).length;

          setStats({ total, upcoming, completed });
        }
      } catch (error) {
        console.error("Failed to fetch appointments:", error);
      }

      // Fetch user rating
      try {
        const userRating = await calculateUserRatingClient(authUser.id);
        setRating(userRating);
      } catch (error) {
        console.error("Failed to fetch rating:", error);
      }

      setLoading(false);
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const userName = user?.user_metadata?.full_name || profile?.full_name || "Patient";
  const isUserAdmin = userRole && isAdmin(userRole);
  const isUserSuperAdmin = userRole && isSuperAdmin(userRole);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Email Verification Banner */}
        {user && !emailVerified && (
          <EmailVerificationBanner
            email={user.email || ""}
            emailVerified={emailVerified}
          />
        )}

        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Welcome back, {userName.split(" ")[0]}!
            </h1>
            {isUserSuperAdmin && (
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                Super Admin
              </span>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Here's an overview of your account
          </p>
          {rating.totalReviews > 0 && (
            <div className="mt-4">
              <UserRatingDisplay
                rating={rating.averageRating}
                totalReviews={rating.totalReviews}
                size="md"
              />
            </div>
          )}
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatsCard
            title="Total Appointments"
            value={stats.total}
            icon={Calendar}
          />
          <StatsCard
            title="Upcoming"
            value={stats.upcoming}
            icon={PlusCircle}
          />
          <StatsCard
            title="Completed"
            value={stats.completed}
            icon={FileText}
          />
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickActionButton
              href="/appointments"
              icon={Calendar}
              label="Book Appointment"
              description="Schedule a consultation"
            />
            <QuickActionButton
              href="/messages"
              icon={MessageSquare}
              label="Messages"
              description="View your messages"
            />
            <QuickActionButton
              href="/profile"
              icon={FileText}
              label="Edit Profile"
              description="Update your information"
            />
            <QuickActionButton
              href="/payments"
              icon={PlusCircle}
              label="View Payments"
              description="Payment history"
            />
            {isUserAdmin && (
              <QuickActionButton
                href="/admin"
                icon={Shield}
                label="Admin Panel"
                description="Manage the system"
              />
            )}
          </div>
        </div>

        {/* Widgets Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UpcomingAppointmentsWidget />
          <PaymentSummaryWidget />
        </div>
      </div>
    </div>
  );
}
