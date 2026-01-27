"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CreditCard, Calendar, MapPin, FileText, AlertCircle, CheckCircle, Phone, Building2, Lock } from "lucide-react";
import { getUserRole, isUserOnly } from "@/lib/auth/rbac-client";
import { UserRole } from "@/types";
import { format } from "date-fns";
import { 
  validateGhanaPhoneNumber, 
  formatGhanaPhoneNumber,
  validateCardNumber,
  formatCardNumber,
  validateExpiryDate,
  formatExpiryDate,
  validateCardPin,
  validateAccountNumber,
  getCardType
} from "@/lib/payments/validation";

const BOOKING_FEE = 100; // Compulsory booking fee in GHS

// Ghanaian banks list
const GHANAIAN_BANKS = [
  "Access Bank Ghana",
  "Agricultural Development Bank (ADB)",
  "Bank of Africa Ghana",
  "CalBank",
  "Ecobank Ghana",
  "Fidelity Bank Ghana",
  "GCB Bank",
  "Guaranty Trust Bank (GTBank) Ghana",
  "Republic Bank Ghana",
  "Standard Chartered Bank Ghana",
  "United Bank for Africa (UBA) Ghana",
  "Zenith Bank Ghana"
];

function AppointmentPaymentContent() {
  const [appointmentData, setAppointmentData] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  
  // Mobile Money state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  
  // Bank Transfer state
  const [selectedBank, setSelectedBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankTransferNotes, setBankTransferNotes] = useState("");
  const [accountError, setAccountError] = useState("");
  
  // Card Payment state
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardPin, setCardPin] = useState("");
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [showCardPin, setShowCardPin] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
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
  }, [checkingRole, userRole, router]);

  // Validate form based on payment method
  const validatePaymentForm = (): boolean => {
    if (!paymentMethod) {
      alert("Please select a payment method");
      return false;
    }

    // Mobile Money validation
    if (["mtn_momo", "vodafone_cash", "airteltigo"].includes(paymentMethod)) {
      if (!phoneNumber.trim()) {
        setPhoneError("Phone number is required");
        return false;
      }
      const formattedPhone = formatGhanaPhoneNumber(phoneNumber);
      if (!validateGhanaPhoneNumber(formattedPhone)) {
        setPhoneError("Please enter a valid 10-digit Ghana phone number (e.g., 0244123456, 0204123456, or 0274123456)");
        return false;
      }
      setPhoneError("");
    }

    // Bank Transfer validation
    if (paymentMethod === "bank_transfer") {
      if (!selectedBank) {
        alert("Please select a bank");
        return false;
      }
      if (!accountNumber.trim()) {
        setAccountError("Account number is required");
        return false;
      }
      if (!validateAccountNumber(accountNumber)) {
        setAccountError("Please enter a valid account number");
        return false;
      }
      setAccountError("");
    }

    // Card Payment validation
    if (paymentMethod === "card") {
      const errors: Record<string, string> = {};
      
      if (!cardNumber.trim()) {
        errors.cardNumber = "Card number is required";
      } else if (!validateCardNumber(cardNumber)) {
        errors.cardNumber = "Please enter a valid card number";
      }
      
      if (!cardExpiry.trim()) {
        errors.cardExpiry = "Expiration date is required";
      } else if (!validateExpiryDate(cardExpiry)) {
        errors.cardExpiry = "Please enter a valid expiration date (MM/YY)";
      }
      
      if (!cardName.trim()) {
        errors.cardName = "Name on card is required";
      }
      
      if (!cardPin.trim()) {
        errors.cardPin = "Card PIN is required";
      } else if (!validateCardPin(cardPin)) {
        errors.cardPin = "PIN must be 4-6 digits";
      }
      
      if (Object.keys(errors).length > 0) {
        setCardErrors(errors);
        return false;
      }
      setCardErrors({});
    }

    return true;
  };

  const handlePayment = async () => {
    // Hard-block: verify prerequisites before taking payment
    try {
      const prereqRes = await fetch("/api/booking/prerequisites");
      const prereq = await prereqRes.json();
      if (!prereqRes.ok) {
        throw new Error(prereq?.error || "Failed to check booking prerequisites");
      }
      if (!prereq.canProceed) {
        alert(
          "Booking is blocked until you verify your email, add full name + phone, and submit required intake forms."
        );
        router.push("/appointments");
        return;
      }
    } catch (err: any) {
      alert(err?.message || "Failed to check booking prerequisites");
      router.push("/appointments");
      return;
    }

    if (!validatePaymentForm()) {
      return;
    }

    setProcessingPayment(true);

    try {
      // Build payment request body
      const paymentBody: any = {
        amount: BOOKING_FEE,
        currency: "GHS",
        payment_method: paymentMethod,
        provider: paymentMethod === "card" ? "paystack" : "custom",
        appointment_data: appointmentData,
      };

      // Add method-specific data
      if (["mtn_momo", "vodafone_cash", "airteltigo"].includes(paymentMethod)) {
        paymentBody.phone_number = formatGhanaPhoneNumber(phoneNumber);
      } else if (paymentMethod === "bank_transfer") {
        paymentBody.bank_name = selectedBank;
        paymentBody.account_number = accountNumber;
        paymentBody.bank_notes = bankTransferNotes;
      } else if (paymentMethod === "card") {
        paymentBody.card_number = cardNumber.replace(/\s+/g, '');
        paymentBody.card_expiry = cardExpiry;
        paymentBody.card_name = cardName;
        paymentBody.card_pin = cardPin;
      }

      // Process payment for booking fee
      const paymentResponse = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentBody),
      });

      if (paymentResponse.ok) {
        const paymentData = await paymentResponse.json();
        
        // For mobile money payments, show message and poll for completion
        if (["mtn_momo", "vodafone_cash", "airteltigo"].includes(paymentMethod)) {
          if (paymentData.payment?.id) {
            // Show Paystack's display_text message if available, otherwise use default
            const displayMessage = paymentData.payment?.metadata?.display_text || 
              "A payment prompt has been sent to your phone. Please enter your Mobile Money PIN to complete the transaction. We will check your payment status automatically.";
            alert(displayMessage);
            
            // Start polling for payment completion
            pollForPaymentCompletion(paymentData.payment.id);
            return;
          }
        }
        
        // If payment URL is returned, redirect to payment gateway (for card payments)
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

  // Poll for mobile money payment completion
  const pollForPaymentCompletion = async (paymentId: string, attempts: number = 0) => {
    const maxAttempts = 30; // Poll for up to 5 minutes (30 attempts * 10 seconds)
    
    if (attempts >= maxAttempts) {
      alert("Payment verification timed out. Please check your payment status or contact support.");
      setProcessingPayment(false);
      return;
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      
      const paymentResponse = await fetch(`/api/payments?id=${paymentId}`);
      if (paymentResponse.ok) {
        const paymentData = await paymentResponse.json();
        const payment = paymentData.payment;
        
        if (payment && payment.status === 'completed') {
          // Payment completed, create appointment
          await handleAppointmentCreation(paymentId);
        } else if (payment && payment.status === 'failed') {
          alert("Payment failed. Please try again.");
          setProcessingPayment(false);
        } else {
          // Still pending, continue polling
          pollForPaymentCompletion(paymentId, attempts + 1);
        }
      } else {
        // Error fetching payment, continue polling
        pollForPaymentCompletion(paymentId, attempts + 1);
      }
    } catch (error) {
      console.error("Error polling payment:", error);
      pollForPaymentCompletion(paymentId, attempts + 1);
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
            Staff members cannot make payments. Please use the admin panel.
          </p>
        </div>
      </div>
    );
  }

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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
              <div className="flex items-center gap-2">
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
                  onChange={(e) => {
                    setPaymentMethod(e.target.value);
                    // Clear errors when changing method
                    setPhoneError("");
                    setAccountError("");
                    setCardErrors({});
                  }}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select payment method</option>
                  <option value="card">Card (Paystack)</option>
                  <option value="mtn_momo">MTN Mobile Money</option>
                  <option value="vodafone_cash">Vodafone Cash</option>
                  <option value="airteltigo">AirtelTigo Money</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              {/* Mobile Money Form */}
              {["mtn_momo", "vodafone_cash", "airteltigo"].includes(paymentMethod) && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        setPhoneNumber(value);
                        if (phoneError) setPhoneError("");
                      }}
                      maxLength={10}
                      placeholder="0244123456 or 0204123456 or 0274123456"
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white ${
                        phoneError 
                          ? "border-red-500 dark:border-red-500" 
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    />
                  </div>
                  {phoneError && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{phoneError}</p>
                  )}
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    A payment prompt will be sent to your phone. Enter your Mobile Money PIN to complete the transaction.
                  </p>
                </div>
              )}

              {/* Bank Transfer Form */}
              {paymentMethod === "bank_transfer" && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Select Bank <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <select
                        value={selectedBank}
                        onChange={(e) => setSelectedBank(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">Select a bank</option>
                        {GHANAIAN_BANKS.map((bank) => (
                          <option key={bank} value={bank}>
                            {bank}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Account Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        setAccountNumber(value);
                        if (accountError) setAccountError("");
                      }}
                      placeholder="Enter your account number"
                      className={`w-full px-4 py-2 border rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white ${
                        accountError 
                          ? "border-red-500 dark:border-red-500" 
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    />
                    {accountError && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{accountError}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Additional Information (Optional)
                    </label>
                    <textarea
                      value={bankTransferNotes}
                      onChange={(e) => setBankTransferNotes(e.target.value)}
                      placeholder="Any additional information for the transfer..."
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* Card Payment Form */}
              {paymentMethod === "card" && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                  {/* Accepted Cards Info */}
                  <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-3">
                    <p className="text-sm font-medium text-primary-800 dark:text-primary-300 mb-2">
                      Accepted Cards
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-primary-700 dark:text-primary-400">
                      <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded">Visa</span>
                      <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded">Mastercard</span>
                      <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded">Verve</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Card Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => {
                        const formatted = formatCardNumber(e.target.value);
                        setCardNumber(formatted);
                        if (cardErrors.cardNumber) {
                          setCardErrors({ ...cardErrors, cardNumber: "" });
                        }
                      }}
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      className={`w-full px-4 py-2 border rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white ${
                        cardErrors.cardNumber 
                          ? "border-red-500 dark:border-red-500" 
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    />
                    {cardErrors.cardNumber && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{cardErrors.cardNumber}</p>
                    )}
                    {cardNumber && !cardErrors.cardNumber && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {getCardType(cardNumber)}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Expiration Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => {
                          const formatted = formatExpiryDate(e.target.value);
                          setCardExpiry(formatted);
                          if (cardErrors.cardExpiry) {
                            setCardErrors({ ...cardErrors, cardExpiry: "" });
                          }
                        }}
                        placeholder="MM/YY"
                        maxLength={5}
                        className={`w-full px-4 py-2 border rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white ${
                          cardErrors.cardExpiry 
                            ? "border-red-500 dark:border-red-500" 
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      />
                      {cardErrors.cardExpiry && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{cardErrors.cardExpiry}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Card PIN <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type={showCardPin ? "text" : "password"}
                          value={cardPin}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setCardPin(value);
                            if (cardErrors.cardPin) {
                              setCardErrors({ ...cardErrors, cardPin: "" });
                            }
                          }}
                          placeholder="••••"
                          maxLength={6}
                          className={`w-full pl-10 pr-4 py-2 border rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white ${
                            cardErrors.cardPin 
                              ? "border-red-500 dark:border-red-500" 
                              : "border-gray-300 dark:border-gray-600"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowCardPin(!showCardPin)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          {showCardPin ? "Hide" : "Show"}
                        </button>
                      </div>
                      {cardErrors.cardPin && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{cardErrors.cardPin}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Name on Card <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={cardName}
                      onChange={(e) => {
                        setCardName(e.target.value);
                        if (cardErrors.cardName) {
                          setCardErrors({ ...cardErrors, cardName: "" });
                        }
                      }}
                      placeholder="John Doe"
                      className={`w-full px-4 py-2 border rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white ${
                        cardErrors.cardName 
                          ? "border-red-500 dark:border-red-500" 
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    />
                    {cardErrors.cardName && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{cardErrors.cardName}</p>
                    )}
                  </div>
                </div>
              )}
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
