"use client";

import { useEffect, useState } from "react";
import { Prescription, PrescriptionRefill } from "@/types";
import { Calendar, Package, AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function PatientPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [refills, setRefills] = useState<PrescriptionRefill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRefillForm, setShowRefillForm] = useState<string | null>(null);
  const [refillRequested, setRefillRequested] = useState(1);

  useEffect(() => {
    fetchPrescriptions();
    fetchRefills();
  }, []);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/prescriptions");
      const data = await response.json();

      if (response.ok) {
        setPrescriptions(data.prescriptions || []);
      } else {
        setError(data.error || "Failed to fetch prescriptions");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fetchRefills = async () => {
    try {
      const response = await fetch("/api/prescriptions/refill");
      const data = await response.json();

      if (response.ok) {
        setRefills(data.refills || []);
      }
    } catch (err) {
      console.error("Failed to fetch refills:", err);
    }
  };

  const handleRefillRequest = async (prescriptionId: string) => {
    try {
      const response = await fetch("/api/prescriptions/refill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prescription_id: prescriptionId,
          requested_refills: refillRequested,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchRefills();
        setShowRefillForm(null);
        alert("Refill request submitted successfully");
      } else {
        alert(data.error || "Failed to submit refill request");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "completed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "expired":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
      default:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    }
  };

  const isExpired = (prescription: Prescription) => {
    if (!prescription.expiry_date) return false;
    return new Date(prescription.expiry_date) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading prescriptions...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          My Prescriptions
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View and manage your herbal medicine prescriptions
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {prescriptions.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Prescriptions Yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don't have any prescriptions yet. Prescriptions will appear here after your appointments.
          </p>
          <Link
            href="/appointments"
            className="inline-block bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
          >
            Book an Appointment
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {prescriptions.map((prescription) => {
            const expired = isExpired(prescription);
            const canRefill = prescription.status === "active" && !expired && prescription.refills_remaining > 0;
            const pendingRefill = refills.find(
              (r) => r.prescription_id === prescription.id && r.status === "pending"
            );

            return (
              <div
                key={prescription.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Prescription #{prescription.id.substring(0, 8)}
                      </h3>
                      <span
                        className={`px-3 py-1 text-xs rounded-full ${getStatusColor(
                          prescription.status
                        )}`}
                      >
                        {prescription.status}
                      </span>
                      {expired && (
                        <span className="px-3 py-1 text-xs rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Expired
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Prescribed: {new Date(prescription.prescribed_date).toLocaleDateString()}
                      </div>
                      {prescription.expiry_date && (
                        <div>
                          Expires: {new Date(prescription.expiry_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Herbs/Formulas:
                  </h4>
                  <div className="space-y-2">
                    {prescription.herbs_formulas.map((herb, idx) => (
                      <div
                        key={idx}
                        className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
                      >
                        <div className="font-medium text-gray-900 dark:text-white">
                          {herb.name}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          <div>
                            <strong>Quantity:</strong> {herb.quantity} {herb.unit}
                          </div>
                          <div>
                            <strong>Dosage:</strong> {herb.dosage}
                          </div>
                          {herb.instructions && (
                            <div>
                              <strong>Instructions:</strong> {herb.instructions}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {prescription.instructions && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                      General Instructions:
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400">{prescription.instructions}</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>Refills:</strong> {prescription.refills_remaining} of{" "}
                    {prescription.refills_original} remaining
                  </div>
                  {canRefill && !pendingRefill && (
                    <div className="flex items-center gap-2">
                      {showRefillForm === prescription.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max={prescription.refills_remaining}
                            value={refillRequested}
                            onChange={(e) => setRefillRequested(parseInt(e.target.value) || 1)}
                            className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white text-gray-900 dark:bg-gray-700 dark:text-white"
                          />
                          <button
                            onClick={() => handleRefillRequest(prescription.id)}
                            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Request Refill
                          </button>
                          <button
                            onClick={() => setShowRefillForm(null)}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowRefillForm(prescription.id)}
                          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Request Refill
                        </button>
                      )}
                    </div>
                  )}
                  {pendingRefill && (
                    <div className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Refill request pending
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
