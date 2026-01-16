"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CreditCard, Calendar, MapPin, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";

const BOOKING_FEE = 100; // Compulsory booking fee in GHS

function AppointmentPaymentContent() {
  const [appointmentData, setAppointmentData] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    // Load appointment data from sessionStorage
    const stored = sessionStorage.getItem('pendingAppointment');
    if (!stored) {
      router.push('/appointments');
      return;
    }

    try {
      const data = JSON.parse(stored);
      setAppointmentData(data);
    } catch (error) {
      console.error("Failed to parse appointment data:", error);
      router.push('/appointments');
    } finally {
      setLoading(false);
    }
  }, []);

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
          appointment_data: appointmentData, // Include appointment data in metadata
        }),
      });

      if (paymentResponse.ok) {
        const paymentData = await paymentResponse.json();
        
        // If payment URL is returned, redirect to payment gateway
        if (paymentData.payment_url) {
          // Store payment ID in sessionStorage for callback
          if (paymentData.payment?.id) {
            sessionStorage.setItem('pendingPaymentId', paymentData.payment.id);
          }
          window.location.href = paymentData.payment_url;
          return;
        }
        
        // If payment is completed immediately, create appointment
        if (paymentData.payment?.id) {
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
    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: appointmentData.branch_id,
          appointment_date: appointmentData.appointment_date,
          treatment_type: appointmentData.treatment_type,
          notes: appointmentData.notes,
          payment_id: paymentId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Clear sessionStorage
        sessionStorage.removeItem('pendingAppointment');
        sessionStorage.removeItem('pendingPaymentId');
        // Redirect to confirmation page with appointment ID
        router.push(`/appointments/confirmation?id=${data.appointment.id}&payment_id=${paymentId}`);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to book appointment. Please contact support.");
      }
    } catch (error) {
      console.error("Appointment creation error:", error);
      alert("Error creating appointment. Please contact support.");
    }
  };

  // Check for payment callback (when returning from payment gateway)
  useEffect(() => {
    const paymentId = searchParams.get('payment_id');
    const reference = searchParams.get('reference'); // Paystack
    const txRef = searchParams.get('tx_ref'); // Flutterwave
    const status = searchParams.get('status');
    const error = searchParams.get('error');
    
    if (error) {
      alert(`Payment error: ${error}`);
      return;
    }
    
    // Handle payment gateway callback
    if (reference || txRef) {
      // Find payment by provider_transaction_id
      findPaymentByReference(reference || txRef || '');
    } else if (paymentId) {
      // Direct payment ID provided
      verifyPaymentAndCreateAppointment(paymentId);
    }
  }, [searchParams]);

  const findPaymentByReference = async (reference: string) => {
    setProcessingPayment(true);
    try {
      // Get all payments and find by provider_transaction_id
      const paymentsResponse = await fetch('/api/payments');
      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        const payments = paymentsData.payments || [];
        const payment = payments.find((p: any) => 
          p.provider_transaction_id === reference || 
          p.provider_transaction_id?.includes(reference)
        );

        if (payment) {
          await verifyPaymentAndCreateAppointment(payment.id);
        } else {
          // Wait a bit for webhook to create payment record
          setTimeout(() => findPaymentByReference(reference), 2000);
        }
      }
    } catch (error) {
      console.error("Error finding payment:", error);
      alert("Error processing payment. Please contact support.");
    } finally {
      setProcessingPayment(false);
    }
  };

  const verifyPaymentAndCreateAppointment = async (paymentId: string) => {
    setProcessingPayment(true);
    try {
      // Wait a moment for webhook to process if needed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify payment status
      const paymentResponse = await fetch(`/api/payments?id=${paymentId}`);
      if (paymentResponse.ok) {
        const paymentData = await paymentResponse.json();
        const payment = paymentData.payment;
        
        if (payment && payment.status === 'completed') {
          // Check if appointment already exists
          if (payment.appointment_id) {
            // Appointment already created, redirect to confirmation
            sessionStorage.removeItem('pendingAppointment');
            router.push(`/appointments/confirmation?id=${payment.appointment_id}&payment_id=${paymentId}`);
          } else {
            // Create appointment
            await handleAppointmentCreation(paymentId);
          }
        } else if (payment && payment.status === 'pending') {
          // Payment still processing, check again
          setTimeout(() => verifyPaymentAndCreateAppointment(paymentId), 2000);
        } else {
          alert("Payment not completed. Please try again.");
        }
      }
    } catch (error) {
      console.error("Payment verification error:", error);
      alert("Error verifying payment. Please contact support.");
    } finally {
      setProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!appointmentData) {
    return null;
  }

  const appointmentDate = new Date(appointmentData.appointment_date);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
          Complete Payment
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Appointment Summary */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Appointment Summary
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Date & Time</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {format(appointmentDate, "EEEE, MMMM d, yyyy")} at {appointmentData.selectedTime}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary-600 dark:text-primary-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Branch</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {appointmentData.branch_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Treatment</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {appointmentData.treatment_name}
                    </p>
                  </div>
                </div>
                {appointmentData.notes && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Notes</p>
                    <p className="text-sm text-gray-900 dark:text-white">{appointmentData.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Payment Method
                </h2>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Select Payment Method <span className="text-red-500">*</span>
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
          </div>

          {/* Payment Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sticky top-4">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Payment Summary
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Booking Fee</span>
                  <span className="font-medium text-gray-900 dark:text-white">GHS {BOOKING_FEE}.00</span>
                </div>
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">Total</span>
                    <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      GHS {BOOKING_FEE}.00
                    </span>
                  </div>
                </div>
                <button
                  onClick={handlePayment}
                  disabled={processingPayment || !paymentMethod}
                  className="w-full bg-primary-600 hover:bg-primary-950 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                >
                  {processingPayment ? "Processing Payment..." : `Pay GHS ${BOOKING_FEE}.00`}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                  Your appointment will be confirmed after successful payment
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppointmentPaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    }>
      <AppointmentPaymentContent />
    </Suspense>
  );
}
