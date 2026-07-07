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

    // P1 — Atomic claim: approved -> processing. If 0 rows match, another operator
    // already claimed/processed it. This single conditional UPDATE serializes
    // concurrent `process` calls, so two workers can never both reach the provider.
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

    // Terminal-state routing. The provider call is the point of no return:
    //   'failed'               → money definitely did NOT move (PRE-provider only);
    //                            an operator can safely re-approve + retry.
    //   'needs_reconciliation' → provider MAY have moved money; `process` refuses
    //                            to re-run it (claim requires 'approved'), so it can
    //                            never be blindly re-refunded. Requires manual/ops
    //                            reconciliation.
    const markTerminal = async (
      status: "failed" | "needs_reconciliation",
      failureReason: string,
      providerRefundId?: string | null
    ) => {
      await service
        .from("refund_requests")
        .update({
          status,
          processed_by: user.id,
          failure_reason: failureReason.slice(0, 500),
          ...(providerRefundId ? { provider_refund_id: providerRefundId } : {}),
          updated_at: nowIso(),
        })
        .eq("id", request_id);
      await audit(
        user.id,
        status === "failed" ? "refund_failed" : "refund_needs_reconciliation",
        refund,
        request,
        { failure_reason: failureReason }
      );
    };

    // Fail-fast BEFORE the provider call: an impossible refund never reaches the
    // provider and money has not moved → 'failed'.
    try {
      computeSettlement(
        { amount: Number(pay.amount), refunded_amount: Number(pay.refunded_amount || 0) },
        Number(refund.amount)
      );
    } catch (preErr: any) {
      await markTerminal("failed", `would_exceed: ${preErr?.message || preErr}`);
      return NextResponse.json(
        { error: "Refund exceeds the captured amount.", code: "REFUND_EXCEEDS_CAPTURED" },
        { status: 422 }
      );
    }

    // P2 — Record provider-call INTENT durably BEFORE calling the provider, so a
    // crash mid-call is detectable (attempted_at set ⇒ treat as maybe-money-moved).
    // If this write fails, the provider was NOT called → 'failed'.
    const { error: intentError } = await service
      .from("refund_requests")
      .update({
        provider_call_attempted_at: nowIso(),
        idempotency_key: request_id,
        updated_at: nowIso(),
      })
      .eq("id", request_id)
      .eq("status", "processing");
    if (intentError) {
      await markTerminal("failed", `intent_write_failed: ${intentError.message}`);
      return NextResponse.json(
        { error: "Refund processing failed before contacting the provider." },
        { status: 502 }
      );
    }

    // P3 — Provider call. ANY failure here is AMBIGUOUS (a throw/timeout may mean
    // the refund actually went through) → 'needs_reconciliation', NEVER 'failed'.
    let providerRefundId: string | null = null;
    try {
      if (isManualRail) {
        // Manual rail: the human already sent the money out-of-band; the payout
        // reference IS the confirmation. No provider HTTP call.
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
    } catch (providerError: any) {
      const reason = String(providerError?.message || providerError).slice(0, 500);
      logger.error("Refund provider call failed — needs reconciliation", providerError, { request_id });
      await markTerminal("needs_reconciliation", `provider_call_failed: ${reason}`);
      return NextResponse.json(
        {
          error:
            "Refund could not be confirmed with the provider and needs reconciliation. It will NOT be retried automatically.",
          code: "REFUND_NEEDS_RECONCILIATION",
        },
        { status: 502 }
      );
    }

    // P4 — Atomic finalize: bump payment + mark processed in ONE transaction
    // (finalize_refund RPC). If this fails, the provider ALREADY moved money →
    // 'needs_reconciliation' (store the provider refund id in the trail), NEVER
    // 'failed'.
    try {
      const { data: finalized, error: finalizeError } = await service.rpc("finalize_refund", {
        p_request_id: request_id,
        p_provider_refund_id: providerRefundId,
      });
      if (finalizeError) throw new Error(finalizeError.message);
      const processed = Array.isArray(finalized) ? finalized[0] : finalized;

      await audit(user.id, "refund_processed", refund, request, {
        amount: refund.amount,
        provider: pay.provider,
        manual: isManualRail,
      });
      return NextResponse.json({ refund: processed }, { status: 200 });
    } catch (finalizeError: any) {
      const reason = String(finalizeError?.message || finalizeError).slice(0, 500);
      logger.error(
        "Refund finalize failed after provider succeeded — needs reconciliation",
        finalizeError,
        { request_id }
      );
      await markTerminal("needs_reconciliation", `finalize_failed: ${reason}`, providerRefundId);
      return NextResponse.json(
        {
          error:
            "Refund was sent to the provider but could not be recorded; it needs reconciliation and will NOT be retried automatically.",
          code: "REFUND_NEEDS_RECONCILIATION",
        },
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
