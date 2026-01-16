"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ModernDatePicker } from "@/components/ui/ModernDatePicker";
import { CreditCard, AlertCircle } from "lucide-react";

const BOOKING_FEE = 100; // Compulsory booking fee in GHS

export default function AppointmentsPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState("");
  const [branchId, setBranchId] = useState("");
  const [treatmentType, setTreatmentType] = useState("");
  const [notes, setNotes] = useState("");
  const [branches, setBranches] = useState<any[]>([]);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
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
  }, []);

  const timeSlots = [
    "09:00", "10:00", "11:00", "12:00",
    "14:00", "15:00", "16:00", "17:00",
  ];

  const handlePayment = async () => {
    if (!paymentMethod) {
      alert("Please select a payment method");
      return;
    }

    setProcessingPayment(true);

    try {
      // Process payment for booking fee
      const paymentResponse = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: BOOKING_FEE,
          currency: "GHS",
          payment_method: paymentMethod,
          provider: paymentMethod === "card" ? "paystack" : "custom",
        }),
      });

      if (paymentResponse.ok) {
        const paymentData = await paymentResponse.json();
        
        // If payment URL is returned, redirect to payment gateway
        if (paymentData.payment_url) {
          window.location.href = paymentData.payment_url;
          return;
        }
        
        // If payment is completed immediately, store payment ID
        if (paymentData.payment?.id) {
          setPaymentId(paymentData.payment.id);
          // Continue with appointment creation
          await handleAppointmentCreation(paymentData.payment.id);
        }
      } else {
        const error = await paymentResponse.json();
        alert(error.error || "Payment failed. Please try again.");
      }
    } catch (error) {
      console.error("Payment error:", error);
      alert("Error processing payment. Please try again.");
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleAppointmentCreation = async (paymentId: string) => {
    setLoading(true);

    const appointmentDateTime = new Date(selectedDate);
    const [hours, minutes] = selectedTime.split(":");
    appointmentDateTime.setHours(parseInt(hours), parseInt(minutes));

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branchId,
          appointment_date: appointmentDateTime.toISOString(),
          treatment_type: treatmentType,
          notes,
          payment_id: paymentId,
        }),
      });

      if (response.ok) {
        router.push("/dashboard");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to book appointment");
      }
    } catch (error) {
      alert("Error booking appointment");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!branchId || !treatmentType || !selectedTime) {
      alert("Please fill in all required fields");
      return;
    }

    // If payment already completed, create appointment
    if (paymentId) {
      await handleAppointmentCreation(paymentId);
      return;
    }

    // Otherwise, process payment first
    await handlePayment();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
          Book Appointment
        </h1>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 space-y-6">
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
            <div className="grid grid-cols-4 gap-2">
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

          {/* Booking Fee Section */}
          <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Booking Fee
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              A compulsory booking fee of <span className="font-bold text-primary-600 dark:text-primary-400">GHS {BOOKING_FEE}</span> is required to confirm your appointment.
            </p>
            
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select payment method</option>
                <option value="card">Card (Paystack)</option>
                <option value="mtn_momo">MTN Mobile Money</option>
                <option value="vodafone_cash">Vodafone Cash</option>
                <option value="airteltigo">AirtelTigo Money</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || processingPayment || !paymentMethod}
            className="w-full bg-primary-600 hover:bg-primary-950 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processingPayment
              ? "Processing Payment..."
              : loading
              ? "Booking Appointment..."
              : paymentId
              ? "Complete Booking"
              : `Pay GHS ${BOOKING_FEE} & Book Appointment`}
          </button>
        </form>
      </div>
    </div>
  );
}
