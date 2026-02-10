"use client";

import { useEffect, useState } from "react";

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAppointments() {
      try {
        const response = await fetch("/api/appointments?admin=true");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch appointments");
        }
        setAppointments(data.appointments || []);
      } catch (error: any) {
        alert(error?.message || "Failed to fetch appointments");
      } finally {
        setLoading(false);
      }
    }

    fetchAppointments();
  }, []);

  const updateStatus = async (id: string, status: "pending" | "confirmed" | "completed" | "cancelled") => {
    const response = await fetch("/api/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointment_id: id,
        action: "update_status",
        status,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      alert(data.error || "Failed to update appointment status");
      return;
    }
    setAppointments((prev) =>
      prev.map((apt) => (apt.id === id ? { ...apt, ...data.appointment } : apt))
    );
  };

  if (loading) {
    return <div>Loading appointments...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
        Manage Appointments
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Patient
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Date & Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Treatment
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Payment
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {appointments.map((appointment) => (
              <tr key={appointment.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {appointment.user?.full_name || appointment.user?.email || `User ID: ${appointment.user_id.substring(0, 8)}...`}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {new Date(appointment.appointment_date).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {appointment.treatment_type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      appointment.status === "confirmed"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : appointment.status === "pending"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {appointment.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {appointment.paid ? (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      PAID
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                      Unpaid
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <select
                    value={appointment.status}
                    onChange={(e) => {
                      const newStatus = e.target.value as "pending" | "confirmed" | "completed" | "cancelled";
                      updateStatus(appointment.id, newStatus);
                    }}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
