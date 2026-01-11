"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { CreditCard, Download, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchPayments();
  }, []);

  async function fetchPayments() {
    try {
      const response = await fetch("/api/payments");
      if (response.ok) {
        const data = await response.json();
        setPayments(data.payments || []);
      }
    } catch (error) {
      console.error("Failed to fetch payments:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredPayments = payments.filter((payment) => {
    if (filter === "all") return true;
    return payment.status === filter;
  });

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    processing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    refunded: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  };

  const totalAmount = filteredPayments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Payments</h1>

        {/* Summary Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Total Paid
            </h2>
          </div>
          <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
            GHS {totalAmount.toFixed(2)}
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {["all", "completed", "pending", "processing", "failed"].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === status
                  ? "bg-primary-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Payments List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          {filteredPayments.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No payments found
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CreditCard className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            GHS {parseFloat(payment.amount || 0).toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {payment.payment_method?.replace("_", " ").toUpperCase() || "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(payment.created_at), "MMM d, yyyy")}
                        </div>
                        {payment.appointment_id && (
                          <Link
                            href={`/appointments/${payment.appointment_id}`}
                            className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
                          >
                            View Appointment
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          statusColors[payment.status as keyof typeof statusColors] ||
                          statusColors.pending
                        }`}
                      >
                        {payment.status}
                      </span>
                      {payment.status === "completed" && (
                        <a
                          href={`/api/payments/${payment.id}/receipt`}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                          title="Download Receipt"
                        >
                          <Download className="w-5 h-5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
