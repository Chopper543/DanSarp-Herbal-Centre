"use client";

import Link from "next/link";
import { Calendar, Clock, MapPin, FileText } from "lucide-react";
import { format } from "date-fns";

interface AppointmentCardProps {
  appointment: {
    id: string;
    appointment_date: string;
    status: "pending" | "confirmed" | "completed" | "cancelled";
    treatment_type: string;
    branch?: {
      name: string;
      address?: string;
    };
    notes?: string | null;
  };
  showActions?: boolean;
}

export function AppointmentCard({ appointment, showActions = true }: AppointmentCardProps) {
  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    confirmed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  const appointmentDate = new Date(appointment.appointment_date);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {appointment.treatment_type}
          </h3>
          <span
            className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-2 ${
              statusColors[appointment.status]
            }`}
          >
            {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
          </span>
        </div>
        {showActions && (
          <Link
            href={`/appointments/${appointment.id}`}
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400 text-sm font-medium"
          >
            View Details
          </Link>
        )}
      </div>

      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span>{format(appointmentDate, "EEEE, MMMM d, yyyy")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>{format(appointmentDate, "h:mm a")}</span>
        </div>
        {appointment.branch && (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span>{appointment.branch.name}</span>
          </div>
        )}
        {appointment.notes && (
          <div className="flex items-start gap-2 mt-2">
            <FileText className="w-4 h-4 mt-0.5" />
            <span className="line-clamp-2">{appointment.notes}</span>
          </div>
        )}
      </div>
    </div>
  );
}
