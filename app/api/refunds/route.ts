import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getUserRole } from "@/lib/auth/rbac";
import { canAccessPaymentLedger } from "@/lib/auth/role-capabilities";
import { paymentService } from "@/lib/payments/payment-service";
import { PaystackProvider } from "@/lib/payments/providers/paystack";
import { FlutterwaveProvider } from "@/lib/payments/providers/flutterwave";
import { GhanaRailsProvider } from "@/lib/payments/providers/ghana-rails";
import { computeSettlement } from "@/lib/payments/refunds";
import { logAuditEvent } from "@/lib/audit/log";
import { logger } from "@/lib/monitoring/logger";
import { internalError, badRequest } from "@/lib/api/errors";

// Register providers (module-load side effect, mirrors app/api/payments/route).
paymentService.registerProvider("paystack", new PaystackProvider());
paymentService.registerProvider("flutterwave", new FlutterwaveProvider());
paymentService.registerProvider("custom", new GhanaRailsProvider());

const requestInfoFrom = (request: NextRequest) => ({
  ip:
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    null,
  userAgent: request.headers.get("user-agent"),
  path: request.nextUrl.pathname,
});

const RefundActionSchema = z.object({
  request_id: z.string().uuid(),
  action: z.enum(["approve", "reject", "process"]),
  reason: z.string().max(2000).optional(),
  // Required for manual (Ghana rails / "custom") refunds: the out-of-band
  // payout reference the finance operator used to send the money back.
  payout_reference: z.string().min(1).max(200).optional(),
});

/**
 * GET /api/refunds — list refund requests.
 * RLS scopes the result: a patient sees their own, finance staff see all.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const paymentId = searchParams.get("payment_id");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));

    // refund_requests isn't in the generated Database type; access it untyped
    // (matches the codebase convention for newer tables).
    const db = supabase as any;
    let query = db.from("refund_requests").select("*", { count: "exact" });
    if (status) query = query.eq("status", status);
    if (paymentId) query = query.eq("payment_id", paymentId);

    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1).order("created_at", { ascending: false });

    const { data: refunds, error, count } = await query;
    if (error) {
      return badRequest("GET /api/refunds", error);
    }

    return NextResponse.json(
      {
        refunds: refunds || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return internalError("GET /api/refunds", error);
  }
}

/**
 * PATCH /api/refunds — finance-staff lifecycle actions on a refund request.
 *   approve: pending  -> approved
 *   reject:  pending  -> rejected (+ reason)
 *   process: approved -> processing -> processed | failed (moves money)
 */
export async function PATCH(request: NextRequest) {
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

    const parsed = RefundActionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid refund action", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { request_id, action, reason, payout_reference } = parsed.data;

    // Mutations run with the service client (after the finance-role check):
    // refund processing must not depend on the operator's per-row RLS and the
    // audit triggers still capture the real actor via auth context.
    // Cast to any: refund_requests / payments.refunded_amount aren't in the
    // generated Database type (codebase convention for newer tables/columns).
    const service = createServiceClient() as any;

    const { data: refundRow, error: loadError } = await service
      .from("refund_requests")
      .select("*")
      .eq("id", request_id)
      .single();
    if (loadError || !refundRow) {
      return NextResponse.json({ error: "Refund request not found" }, { status: 404 });
    }
    const refund = refundRow as any;
    const nowIso = () => new Date().toISOString();

    if (action === "approve") {
      if (refund.status !== "pending") {
        return NextResponse.json(
          { error: `Cannot approve a refund in status "${refund.status}"` },
          { status: 409 }
        );
      }
      const { data: updated, error } = await service
        .from("refund_requests")
        .update({ status: "approved", processed_by: user.id, updated_at: nowIso() })
        .eq("id", request_id)
        .eq("status", "pending")
        .select()
        .single();
      if (error || !updated) return badRequest("PATCH /api/refunds approve", error);
      await audit(user.id, "refund_approved", refund, request);
      return NextResponse.json({ refund: updated }, { status: 200 });
    }

    if (action === "reject") {
      if (refund.status !== "pending") {
        return NextResponse.json(
          { error: `Cannot reject a refund in status "${refund.status}"` },
          { status: 409 }
        );
      }
      const { data: updated, error } = await service
        .from("refund_requests")
        .update({
          status: "rejected",
          processed_by: user.id,
          failure_reason: reason || null,
          updated_at: nowIso(),
        })
        .eq("id", request_id)
        .eq("status", "pending")
        .select()
        .single();
      if (error || !updated) return badRequest("PATCH /api/refunds reject", error);
      await audit(user.id, "refund_rejected", refund, request, { reason });
      return NextResponse.json({ refund: updated }, { status: 200 });
    }

    // action === "process"
    const { data: payment, error: payErr } = await service
      .from("payments")
      .select("id, provider, provider_transaction_id, amount, refunded_amount, status")
      .eq("id", refund.payment_id)
      .single();
    if (payErr || !payment) {
      return NextResponse.json({ error: "Linked payment not found" }, { status: 404 });
    }
    const pay = payment as any;
    const isManualRail = pay.provider === "custom";

    // Manual rails settle out-of-band — require the payout reference up front so
    // we never mark a manual refund processed without proof of the payout.
    if (isManualRail && !payout_reference) {
      return NextResponse.json(
        {
          error:
            "payout_reference is required to process a manual (Ghana rails) refund. Send the money first, then record its reference.",
          code: "MANUAL_PAYOUT_REFERENCE_REQUIRED",
        },
        { status: 422 }
      );
    }

    // Atomic claim: approved -> processing. If 0 rows match, another operator
    // already claimed/processed it.
    const { data: claimed } = await service
      .from("refund_requests")
      .update({ status: "processing", processed_by: user.id, updated_at: nowIso() })
      .eq("id", request_id)
      .eq("status", "approved")
      .select()
      .single();
    if (!claimed) {
      return NextResponse.json(
        { error: "Refund must be in status \"approved\" to process (it may already be in progress)" },
        { status: 409 }
      );
    }

    try {
      let providerRefundId: string | null = null;
      if (isManualRail) {
        providerRefundId = payout_reference!;
      } else {
        const resp = await paymentService.refundPayment(
          pay.provider,
          pay.provider_transaction_id,
          refund.amount
        );
        if (resp.status !== "refunded") {
          throw new Error(`Provider did not confirm refund (status: ${resp.status})`);
        }
        providerRefundId = resp.provider_transaction_id || resp.id || null;
      }

      const settlement = computeSettlement(
        { amount: Number(pay.amount), refunded_amount: Number(pay.refunded_amount || 0) },
        Number(refund.amount)
      );

      // Bumping refunded_amount drives the payment_ledger refund entry (trigger).
      const { error: payUpdateError } = await service
        .from("payments")
        .update({
          refunded_amount: settlement.newRefundedAmount,
          status: settlement.fullyRefunded ? "refunded" : pay.status,
          updated_at: nowIso(),
        })
        .eq("id", pay.id);
      if (payUpdateError) throw new Error(payUpdateError.message);

      const { data: processed, error: finalizeError } = await service
        .from("refund_requests")
        .update({
          status: "processed",
          provider_refund_id: providerRefundId,
          processed_by: user.id,
          processed_at: nowIso(),
          updated_at: nowIso(),
        })
        .eq("id", request_id)
        .select()
        .single();
      if (finalizeError) throw new Error(finalizeError.message);

      await audit(user.id, "refund_processed", refund, request, {
        amount: refund.amount,
        provider: pay.provider,
        fully_refunded: settlement.fullyRefunded,
        manual: isManualRail,
      });
      return NextResponse.json({ refund: processed }, { status: 200 });
    } catch (processError: any) {
      const failureReason = String(processError?.message || processError).slice(0, 500);
      logger.error("Refund processing failed", processError, { request_id });
      await service
        .from("refund_requests")
        .update({
          status: "failed",
          processed_by: user.id,
          failure_reason: failureReason,
          updated_at: nowIso(),
        })
        .eq("id", request_id);
      await audit(user.id, "refund_failed", refund, request, { failure_reason: failureReason });
      return NextResponse.json(
        { error: "Refund processing failed. The request was marked failed and can be retried." },
        { status: 502 }
      );
    }
  } catch (error) {
    return internalError("PATCH /api/refunds", error);
  }
}

async function audit(
  userId: string,
  action: string,
  refund: any,
  request: NextRequest,
  extra?: Record<string, any>
) {
  await logAuditEvent({
    userId,
    action,
    resourceType: "refund_request",
    resourceId: refund.id,
    metadata: {
      payment_id: refund.payment_id,
      appointment_id: refund.appointment_id,
      tier: refund.tier,
      requested_by: refund.requested_by,
      ...(extra || {}),
    },
    requestInfo: requestInfoFrom(request),
  });
}
