"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function PaymentCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    async function handleCallback() {
      const reference = searchParams.get('reference') || searchParams.get('tx_ref');
      const status = searchParams.get('status');
      
      if (!reference) {
        router.push('/appointments/payment?error=no_reference');
        return;
      }

      // Check if this is for an appointment booking
      const pendingAppointment = sessionStorage.getItem('pendingAppointment');
      
      if (pendingAppointment) {
        // This is an appointment booking payment
        // Find payment by provider_transaction_id
        try {
          // Wait a moment for webhook to process
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check payment status
          const paymentsResponse = await fetch('/api/payments');
          if (paymentsResponse.ok) {
            const paymentsData = await paymentsResponse.json();
            const payments = paymentsData.payments || [];
            
            // Find payment by reference (provider_transaction_id)
            const payment = payments.find((p: any) => 
              p.provider_transaction_id === reference || 
              p.provider_transaction_id?.includes(reference)
            );

            if (payment && payment.status === 'completed') {
              // Payment successful, create appointment
              const appointmentData = JSON.parse(pendingAppointment);
              
              const appointmentResponse = await fetch('/api/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  branch_id: appointmentData.branch_id,
                  appointment_date: appointmentData.appointment_date,
                  treatment_type: appointmentData.treatment_type,
                  notes: appointmentData.notes,
                  payment_id: payment.id,
                }),
              });

              if (appointmentResponse.ok) {
                const appointmentData = await appointmentResponse.json();
                sessionStorage.removeItem('pendingAppointment');
                router.push(`/appointments/confirmation?id=${appointmentData.appointment.id}&payment_id=${payment.id}`);
              } else {
                router.push('/appointments/payment?error=appointment_failed');
              }
            } else if (payment && payment.status === 'pending') {
              // Payment still processing, redirect to payment page to check status
              router.push(`/appointments/payment?payment_id=${payment.id}&status=processing`);
            } else {
              router.push('/appointments/payment?error=payment_not_found');
            }
          } else {
            router.push('/appointments/payment?error=payment_check_failed');
          }
        } catch (error) {
          console.error('Callback error:', error);
          router.push('/appointments/payment?error=callback_error');
        }
      } else {
        // Regular payment, redirect to payments page
        router.push('/payments');
      }
    }

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Processing payment...</p>
      </div>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    }>
      <PaymentCallbackContent />
    </Suspense>
  );
}
