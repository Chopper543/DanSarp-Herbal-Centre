"use client";

import { useEffect, useState } from "react";
import { CreditCard, TrendingUp } from "lucide-react";
import Link from "next/link";

export function PaymentSummaryWidget() {
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPayments() {
      try {
        const response = await fetch("/api/payments");
        if (response.ok) {
          const data = await response.json();
          const payments = data.payments || [];
          
          const total = payments.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
          const pending = payments
            .filter((p: any) => p.status === "pending" || p.status === "processing")
            .reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
          const completed = payments
            .filter((p: any) => p.status === "completed")
            .reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);

          setSummary({ total, pending, completed });
        }
      } catch (error) {
        console.error("Failed to fetch payments:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPayments();
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Payment Summary
          </h2>
        </div>
        <Link
          href="/payments"
          className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
        >
          View All
        </Link>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Total Paid</span>
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            GHS {summary.completed.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Pending</span>
          <span className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">
            GHS {summary.pending.toFixed(2)}
          </span>
        </div>
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <TrendingUp className="w-4 h-4" />
            <span>All transactions</span>
          </div>
        </div>
      </div>
    </div>
  );
}
