import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, getUserRole } from "@/lib/auth/rbac";
import { canAccessSection, canAccessPaymentLedger } from "@/lib/auth/role-capabilities";
import { badRequest, authAwareError } from "@/lib/api/errors";

export async function GET(_request: NextRequest) {
  try {
    await requireAuth(["super_admin", "admin", "finance_manager"]);
    const role = await getUserRole();
    if (!role || !canAccessSection(role, "payments")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createClient();
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("id, provider_transaction_id, amount, payment_method, status, created_at")
      .order("created_at", { ascending: false })
      .limit(300);

    if (paymentsError) {
      return badRequest("/api/admin/payments", paymentsError);
    }

    const totalRevenue = (payments || [])
      .filter((payment: any) => payment.status === "completed")
      .reduce((sum: number, payment: any) => sum + parseFloat(payment.amount.toString()), 0);

    let ledgerEntries: any[] = [];
    if (canAccessPaymentLedger(role)) {
      const { data: ledger, error: ledgerError } = await supabase
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
      if (ledgerError) {
        return badRequest("/api/admin/payments", ledgerError);
      }
      ledgerEntries = ledger || [];
    }

    return NextResponse.json(
      {
        payments: payments || [],
        ledgerEntries,
        totalRevenue,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return authAwareError("GET /api/admin/payments", error, "Failed to load payments");
  }
}
