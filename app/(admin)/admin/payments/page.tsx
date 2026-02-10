import { redirect } from "next/navigation";
import { Receipt, CreditCard, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, requireAuth } from "@/lib/auth/rbac";
import { canAccessSection, canAccessPaymentLedger } from "@/lib/auth/role-capabilities";

export const revalidate = 0;

export default async function AdminPaymentsPage() {
  await requireAuth(["super_admin", "admin", "finance_manager"]);
  const role = await getUserRole();

  if (!role || !canAccessSection(role, "payments")) {
    redirect("/admin");
  }

  const supabase = await createClient();
  const { data: paymentsData } = await supabase
    .from("payments")
    .select("id, provider_transaction_id, amount, payment_method, status, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  const payments = (paymentsData || []) as any[];

  let ledgerEntries: any[] = [];
  if (canAccessPaymentLedger(role)) {
    const { data = [] } = await supabase
      .from("payment_ledger")
      .select(`
        id,
        payment_id,
        transaction_type,
        amount,
        balance_after,
        created_at,
        payment:payments!payment_ledger_payment_id_fkey (
          id,
          payment_method,
          status,
          users:user_id (
            full_name,
            email
          )
        )
      `)
      .order("created_at", { ascending: false })
      .limit(300);
    ledgerEntries = data as any[];
  }

  const totalRevenue = payments
    .filter((payment: any) => payment.status === "completed")
    .reduce((sum: number, payment: any) => sum + parseFloat(payment.amount.toString()), 0);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        Payment Management
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p>
            <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
              GHS {totalRevenue.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Payments</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Transaction ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Method
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {payments.map((payment: any) => (
              <tr key={payment.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {payment.provider_transaction_id || payment.id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  GHS {parseFloat(payment.amount.toString()).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {payment.payment_method.replace("_", " ")}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      payment.status === "completed"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : payment.status === "pending"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          : payment.status === "failed"
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {payment.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {new Date(payment.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {canAccessPaymentLedger(role) && (
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Ledger</h2>
          </div>
          {ledgerEntries.length === 0 ? (
            <p className="px-6 py-6 text-sm text-gray-600 dark:text-gray-400">No ledger entries found.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Balance After
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Payment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    User
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {ledgerEntries.map((entry: any) => (
                  <tr key={entry.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {entry.transaction_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      GHS {parseFloat(entry.amount.toString()).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      GHS {parseFloat(entry.balance_after.toString()).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {entry.payment?.payment_method || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {entry.payment?.users?.full_name || entry.payment?.users?.email || "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
