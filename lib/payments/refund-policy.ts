/**
 * Refund tier calculation for appointment cancellations.
 *
 * Policy (signed off as the operating refund window):
 *   ≥ 24h before appointment  → full refund   (100%)
 *   ≥ 12h and < 24h            → partial      (50%)
 *   < 12h                      → none
 *   appointment in the past   → none + APPOINTMENT_IN_PAST
 *
 * Pure function — no IO, no clocks-from-Date.now(). Callers pass an explicit
 * `cancelledAt` so the policy is testable and replayable from audit data.
 */

export type RefundTier = "full" | "partial" | "none";

export type RefundReasonCode =
  | "FULL_REFUND_WINDOW"
  | "PARTIAL_REFUND_WINDOW"
  | "OUTSIDE_REFUND_WINDOW"
  | "APPOINTMENT_IN_PAST"
  | "ZERO_AMOUNT";

export interface RefundTierInput {
  amountPaid: number;
  appointmentDate: Date | string;
  cancelledAt: Date | string;
}

export interface RefundTierResult {
  tier: RefundTier;
  amount: number;
  reasonCode: RefundReasonCode;
  hoursBeforeAppointment: number;
}

const FULL_REFUND_THRESHOLD_HOURS = 24;
const PARTIAL_REFUND_THRESHOLD_HOURS = 12;
const PARTIAL_REFUND_MULTIPLIER = 0.5;

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function roundCurrency(value: number): number {
  // GHS stored as DECIMAL(10,2). Round half-up to two decimals to match.
  return Math.round(value * 100) / 100;
}

export function calculateRefundTier(input: RefundTierInput): RefundTierResult {
  const appointmentDate = toDate(input.appointmentDate);
  const cancelledAt = toDate(input.cancelledAt);

  const msBefore = appointmentDate.getTime() - cancelledAt.getTime();
  const hoursBeforeAppointment = msBefore / (1000 * 60 * 60);

  if (input.amountPaid <= 0) {
    return {
      tier: "none",
      amount: 0,
      reasonCode: "ZERO_AMOUNT",
      hoursBeforeAppointment,
    };
  }

  if (hoursBeforeAppointment < 0) {
    return {
      tier: "none",
      amount: 0,
      reasonCode: "APPOINTMENT_IN_PAST",
      hoursBeforeAppointment,
    };
  }

  if (hoursBeforeAppointment >= FULL_REFUND_THRESHOLD_HOURS) {
    return {
      tier: "full",
      amount: roundCurrency(input.amountPaid),
      reasonCode: "FULL_REFUND_WINDOW",
      hoursBeforeAppointment,
    };
  }

  if (hoursBeforeAppointment >= PARTIAL_REFUND_THRESHOLD_HOURS) {
    return {
      tier: "partial",
      amount: roundCurrency(input.amountPaid * PARTIAL_REFUND_MULTIPLIER),
      reasonCode: "PARTIAL_REFUND_WINDOW",
      hoursBeforeAppointment,
    };
  }

  return {
    tier: "none",
    amount: 0,
    reasonCode: "OUTSIDE_REFUND_WINDOW",
    hoursBeforeAppointment,
  };
}
