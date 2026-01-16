"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle, Calendar, MapPin, FileText, CreditCard, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

function AppointmentConfirmationContent() {
  const [appointment, setAppointment] = useState<any>(null);
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const appointmentId = searchParams.get('id');
    const paymentId = searchParams.get('payment_id');

    if (appointmentId) {
      fetchAppointmentDetails(appointmentId, paymentId);
    } else {
      router.push('/dashboard');
    }
  }, []);

  async function fetchAppointmentDetails(appointmentId: string, paymentId: string | null) {
    try {
      // Fetch appointment
      const appointmentResponse = await fetch(`/api/appointments?id=${appointmentId}`);
      if (appointmentResponse.ok) {
        const appointmentData = await appointmentResponse.json();
        const appointments = appointmentData.appointments || [];
        const foundAppointment = appointments.find((apt: any) => apt.id === appointmentId);
        setAppointment(foundAppointment);
      }

      // Fetch payment if payment ID provided
      if (paymentId) {
        const paymentResponse = await fetch(`/api/payments?id=${paymentId}`);
        if (paymentResponse.ok) {
          const paymentData = await paymentResponse.json();
          setPayment(paymentData.payment);
        }
      }
    } catch (error) {
      console.error("Failed to fetch details:", error);
    } finally {
      setLoading(false);
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Appointment not found.</p>
          <Link href="/dashboard" className="text-primary-600 hover:text-primary-700 dark:text-primary-400">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const appointmentDate = new Date(appointment.appointment_date);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Appointment Confirmed!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Your appointment has been successfully booked and payment has been received.
          </p>
        </div>

        {/* Appointment Details */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Appointment Details
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Date & Time</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {format(appointmentDate, "EEEE, MMMM d, yyyy")} at {format(appointmentDate, "h:mm a")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Treatment</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {appointment.treatment_type}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-primary-600 dark:text-primary-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  appointment.status === 'confirmed'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : appointment.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        {payment && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Payment Details
              </h2>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Amount Paid</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  GHS {parseFloat(payment.amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Payment Method</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {payment.payment_method.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Payment Status</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href={`/appointments/${appointment.id}`}
            className="flex-1 bg-primary-600 hover:bg-primary-950 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-center"
          >
            View Appointment
          </Link>
          <Link
            href="/dashboard"
            className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold py-3 px-4 rounded-lg transition-colors text-center flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AppointmentConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    }>
      <AppointmentConfirmationContent />
    </Suspense>
  );
}
