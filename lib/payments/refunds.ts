import { calculateRefundTier, type RefundTier } from "./refund-policy";

/**
 * Refund pipeline pure logic. No IO — callers pass plain values so the policy
 * and settlement math stay testable and replayable from audit data. The route
 * layer (app/api/refunds) owns the DB/provider side effects.
 */

export interface RefundEligibility {
  tier: RefundTier; // "full" | "partial" | "none"
  amount: number;
  reasonCode: string;
}

/**
 * Decide what refund a cancellation is eligible for, against the *remaining*
 * refundable balance (amount minus anything already refunded). Returns null
 * when there's nothing to refund: no completed payment, fully refunded already,
 * or the time-based policy yields tier "none".
 */
export function evaluateCancellationRefund(params: {
  payment: { amount: number; refunded_amount?: number | null } | null | undefined;
  appointmentDate: Date | string;
  cancelledAt: Date | string;
}): RefundEligibility | null {
  const { payment, appointmentDate, cancelledAt } = params;
  if (!payment) return null;

  const alreadyRefunded = payment.refunded_amount ?? 0;
  const refundable = round2(payment.amount - alreadyRefunded);
  if (refundable <= 0) return null;

  const tier = calculateRefundTier({
    amountPaid: refundable,
    appointmentDate,
    cancelledAt,
  });

  if (tier.tier === "none" || tier.amount <= 0) return null;
  return { tier: tier.tier, amount: tier.amount, reasonCode: tier.reasonCode };
}

export interface Settlement {
  newRefundedAmount: number;
  fullyRefunded: boolean;
}

/**
 * Compute the post-refund state for a payment. Throws if the refund would
 * exceed the captured amount — the DB CHECK (`payments_refunded_amount_not_over`)
 * is the backstop, but failing fast here keeps us from calling the provider for
 * an impossible refund.
 */
export function computeSettlement(
  payment: { amount: number; refunded_amount: number },
  refundAmount: number
): Settlement {
  if (!(refundAmount > 0)) {
    throw new Error("Refund amount must be positive");
  }
  const newRefundedAmount = round2((payment.refunded_amount ?? 0) + refundAmount);
  // Tolerance for binary-float noise on DECIMAL(10,2) values.
  if (newRefundedAmount > payment.amount + 1e-9) {
    throw new Error(
      `Refund would exceed captured amount (refunded ${newRefundedAmount} > paid ${payment.amount})`
    );
  }
  return {
    newRefundedAmount,
    fullyRefunded: newRefundedAmount >= payment.amount - 1e-9,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
