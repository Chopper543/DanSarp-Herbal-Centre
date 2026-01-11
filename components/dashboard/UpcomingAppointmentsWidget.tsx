"use client";

import { useEffect, useState } from "react";
import { AppointmentCard } from "./AppointmentCard";
import { Calendar } from "lucide-react";
import Link from "next/link";

export function UpcomingAppointmentsWidget() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAppointments() {
      try {
        const response = await fetch("/api/appointments");
        if (response.ok) {
          const data = await response.json();
          const upcoming = (data.appointments || [])
            .filter((apt: any) => {
              const aptDate = new Date(apt.appointment_date);
              const now = new Date();
              return aptDate >= now && apt.status !== "cancelled";
            })
            .slice(0, 3);
          setAppointments(upcoming);
        }
      } catch (error) {
        console.error("Failed to fetch appointments:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAppointments();
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Upcoming Appointments
          </h2>
        </div>
        <Link
          href="/appointments"
          className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
        >
          View All
        </Link>
      </div>

      {appointments.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          No upcoming appointments.{" "}
          <Link href="/appointments" className="text-primary-600 hover:text-primary-700 dark:text-primary-400">
            Book one now
          </Link>
        </p>
      ) : (
        <div className="space-y-4">
          {appointments.map((appointment) => (
            <AppointmentCard key={appointment.id} appointment={appointment} showActions={false} />
          ))}
        </div>
      )}
    </div>
  );
}
