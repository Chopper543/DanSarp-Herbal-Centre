"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import { Calendar, Clock, MapPin, FileText, ArrowLeft, Edit, X } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { ModernDatePicker } from "@/components/ui/ModernDatePicker";

export default function AppointmentDetailPage() {
  const params = useParams();
  const appointmentId = params.id as string;
  const [appointment, setAppointment] = useState<any>(null);
  const [branch, setBranch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date>(new Date());
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [processing, setProcessing] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const timeSlots = [
    "09:00", "10:00", "11:00", "12:00",
    "14:00", "15:00", "16:00", "17:00",
  ];

  useEffect(() => {
    fetchAppointment();
  }, [appointmentId]);

  async function fetchAppointment() {
    try {
      const response = await fetch("/api/appointments");
      if (response.ok) {
        const data = await response.json();
        const apt = (data.appointments || []).find((a: any) => a.id === appointmentId);
        if (apt) {
          setAppointment(apt);

          // Fetch branch details
          if (apt.branch_id) {
            // @ts-ignore - Supabase type inference issue with branches table
            const { data: branchData } = await supabase
              .from("branches")
              .select("*")
              .eq("id", apt.branch_id)
              .single();
            setBranch(branchData);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch appointment:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleReschedule() {
    if (!rescheduleDate || !rescheduleTime) {
      alert("Please select both date and time");
      return;
    }

    setProcessing(true);
    try {
      const appointmentDateTime = new Date(rescheduleDate);
      const [hours, minutes] = rescheduleTime.split(":");
      appointmentDateTime.setHours(parseInt(hours), parseInt(minutes));

      const response = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: appointmentId,
          action: "reschedule",
          appointment_date: appointmentDateTime.toISOString(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reschedule");
      }

      alert("Appointment rescheduled successfully!");
      setShowReschedule(false);
      fetchAppointment();
    } catch (error: any) {
      alert("Failed to reschedule: " + error.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel this appointment?")) {
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: appointmentId,
          action: "cancel",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel");
      }

      alert("Appointment cancelled successfully!");
      router.push("/appointments/list");
    } catch (error: any) {
      alert("Failed to cancel: " + error.message);
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Appointment not found</p>
          <Link
            href="/appointments/list"
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            Back to Appointments
          </Link>
        </div>
      </div>
    );
  }

  const appointmentDate = new Date(appointment.appointment_date);
  const now = new Date();
  const hoursUntilAppointment = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  const canReschedule = hoursUntilAppointment > 24 || appointment.status === "pending";
  const canCancel = hoursUntilAppointment > 24 || appointment.status === "pending";

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    confirmed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/appointments/list"
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Appointments
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Appointment Details
            </h1>
            <span
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                statusColors[appointment.status as keyof typeof statusColors] || statusColors.pending
              }`}
            >
              {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
            </span>
          </div>

          <div className="space-y-6">
            {/* Treatment */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Treatment
              </h2>
              <p className="text-gray-700 dark:text-gray-300">{appointment.treatment_type}</p>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
                  <p className="text-gray-900 dark:text-white">
                    {format(appointmentDate, "EEEE, MMMM d, yyyy")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Time</p>
                  <p className="text-gray-900 dark:text-white">
                    {format(appointmentDate, "h:mm a")}
                  </p>
                </div>
              </div>
            </div>

            {/* Branch */}
            {branch && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Branch</p>
                  <p className="text-gray-900 dark:text-white font-medium">{branch.name}</p>
                  {branch.address && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{branch.address}</p>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {appointment.notes && (
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Notes</p>
                  <p className="text-gray-700 dark:text-gray-300">{appointment.notes}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            {appointment.status !== "completed" && appointment.status !== "cancelled" && (
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700 flex gap-4">
                {canReschedule && (
                  <button
                    onClick={() => setShowReschedule(true)}
                    disabled={processing}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-800 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Edit className="w-4 h-4" />
                    Reschedule
                  </button>
                )}
                {canCancel && (
                  <button
                    onClick={handleCancel}
                    disabled={processing}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Reschedule Modal */}
        {showReschedule && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Reschedule Appointment
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Date
                  </label>
                  <ModernDatePicker
                    value={rescheduleDate}
                    onChange={(date) => setRescheduleDate(date)}
                    minDate={new Date()}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Time
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {timeSlots.map((time) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setRescheduleTime(time)}
                        className={`py-2 px-4 rounded-lg border ${
                          rescheduleTime === time
                            ? "bg-primary-600 text-white border-primary-600"
                            : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={handleReschedule}
                    disabled={processing || !rescheduleTime}
                    className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-800 text-white rounded-lg disabled:opacity-50"
                  >
                    {processing ? "Processing..." : "Reschedule"}
                  </button>
                  <button
                    onClick={() => {
                      setShowReschedule(false);
                      setRescheduleTime("");
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
