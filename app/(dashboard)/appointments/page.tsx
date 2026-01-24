"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ModernDatePicker } from "@/components/ui/ModernDatePicker";
import { AlertCircle } from "lucide-react";
import { getUserRole, isUserOnly } from "@/lib/auth/rbac-client";
import { UserRole } from "@/types";

export default function AppointmentsPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState("");
  const [branchId, setBranchId] = useState("");
  const [treatmentType, setTreatmentType] = useState("");
  const [notes, setNotes] = useState("");
  const [branches, setBranches] = useState<any[]>([]);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkRole() {
      const role = await getUserRole();
      setUserRole(role);
      setCheckingRole(false);

      if (!isUserOnly(role)) {
        router.push("/dashboard");
        return;
      }
    }
    checkRole();
  }, [router]);

  useEffect(() => {
    if (checkingRole || !isUserOnly(userRole)) {
      return;
    }

    async function fetchData() {
      const { data: branchesData } = await supabase
        .from("branches")
        .select("*")
        .eq("is_active", true);

      const { data: treatmentsData } = await supabase
        .from("treatments")
        .select("*")
        .eq("is_active", true);

      if (branchesData) setBranches(branchesData);
      if (treatmentsData) setTreatments(treatmentsData);
    }

    fetchData();
  }, [checkingRole, userRole]);

  const timeSlots = [
    "09:00", "10:00", "11:00", "12:00",
    "14:00", "15:00", "16:00", "17:00",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!branchId || !treatmentType || !selectedTime) {
      alert("Please fill in all required fields");
      return;
    }

    // Calculate appointment date/time
    const appointmentDateTime = new Date(selectedDate);
    const [hours, minutes] = selectedTime.split(":");
    appointmentDateTime.setHours(parseInt(hours), parseInt(minutes));

    // Get branch name for display
    const selectedBranch = branches.find(b => b.id === branchId);
    const selectedTreatment = treatments.find(t => t.name === treatmentType);

    // Store appointment details temporarily
    const appointmentData = {
      branch_id: branchId,
      branch_name: selectedBranch?.name || "",
      appointment_date: appointmentDateTime.toISOString(),
      treatment_type: treatmentType,
      treatment_name: selectedTreatment?.name || treatmentType,
      notes,
      selectedDate: selectedDate.toISOString(),
      selectedTime,
    };

    // Store in sessionStorage for payment page
    sessionStorage.setItem('pendingAppointment', JSON.stringify(appointmentData));
    
    // Redirect to payment page
    router.push('/appointments/payment');
  };

  if (checkingRole) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!isUserOnly(userRole)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Staff members cannot book appointments. Please use the admin panel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-8 text-gray-900 dark:text-white">
          Book Appointment
        </h1>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 lg:p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-4 text-gray-700 dark:text-gray-300">
              Select Date
            </label>
            <ModernDatePicker
              value={selectedDate}
              onChange={(date) => setSelectedDate(date)}
              minDate={new Date()}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Select Time
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {timeSlots.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => setSelectedTime(time)}
                  className={`py-2 px-4 rounded-lg border ${
                    selectedTime === time
                      ? "bg-primary-600 text-white border-primary-600"
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Branch
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select a branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Treatment Type
            </label>
            <select
              value={treatmentType}
              onChange={(e) => setTreatmentType(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select treatment</option>
              {treatments.map((treatment) => (
                <option key={treatment.id} value={treatment.name}>
                  {treatment.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Booking Fee Notice */}
          <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-primary-600 dark:text-primary-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-primary-800 dark:text-primary-300">
                  Booking Fee Required
                </p>
                <p className="text-sm text-primary-700 dark:text-primary-400 mt-1">
                  A compulsory booking fee of <span className="font-bold">GHS 100</span> is required to confirm your appointment. You will be redirected to the payment page after clicking "Book Appointment".
                </p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-950 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Processing..." : "Book Appointment"}
          </button>
        </form>
      </div>
    </div>
  );
}
