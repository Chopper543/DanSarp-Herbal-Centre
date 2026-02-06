import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth/rbac";
import { canAccessPaymentLedger } from "@/lib/auth/role-capabilities";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getUserRole();
    if (!canAccessPaymentLedger(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get("payment_id");
    const limit = parseInt(searchParams.get("limit") || "100");

    // @ts-ignore - Supabase type inference issue
    let query = supabase
      .from("payment_ledger")
      .select(`
        *,
        payment:payments!payment_ledger_payment_id_fkey (
          id,
          user_id,
          amount,
          currency,
          payment_method,
          status,
          created_at,
          users:user_id (
            id,
            email,
            full_name
          )
        )
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (paymentId) {
      query = query.eq("payment_id", paymentId);
    }

    // @ts-ignore - Supabase type inference issue
    const { data: ledgerEntries, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ledgerEntries }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
