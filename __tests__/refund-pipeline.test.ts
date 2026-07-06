/**
 * @jest-environment node
 *
 * Refund pipeline pure logic: cancellation eligibility (against the remaining
 * refundable balance) and settlement math (with over-refund guard).
 */

import { evaluateCancellationRefund, computeSettlement } from "../lib/payments/refunds";

const APPT = "2026-07-01T12:00:00.000Z";
const hoursBefore = (h: number) => new Date(Date.parse(APPT) - h * 3600 * 1000).toISOString();

describe("evaluateCancellationRefund", () => {
  it("full refund when cancelled >= 24h before", () => {
    const r = evaluateCancellationRefund({
      payment: { amount: 100 },
      appointmentDate: APPT,
      cancelledAt: hoursBefore(25),
    });
    expect(r).toEqual({ tier: "full", amount: 100, reasonCode: "FULL_REFUND_WINDOW" });
  });

  it("partial (50%) when cancelled in [12h, 24h)", () => {
    const r = evaluateCancellationRefund({
      payment: { amount: 100 },
      appointmentDate: APPT,
      cancelledAt: hoursBefore(13),
    });
    expect(r?.tier).toBe("partial");
    expect(r?.amount).toBe(50);
  });

  it("null (nothing to do) when inside the no-refund window", () => {
    expect(
      evaluateCancellationRefund({
        payment: { amount: 100 },
        appointmentDate: APPT,
        cancelledAt: hoursBefore(2),
      })
    ).toBeNull();
  });

  it("null when there is no completed payment", () => {
    expect(
      evaluateCancellationRefund({ payment: null, appointmentDate: APPT, cancelledAt: hoursBefore(25) })
    ).toBeNull();
  });

  it("null when already fully refunded", () => {
    expect(
      evaluateCancellationRefund({
        payment: { amount: 100, refunded_amount: 100 },
        appointmentDate: APPT,
        cancelledAt: hoursBefore(25),
      })
    ).toBeNull();
  });

  it("bases the tier on the remaining refundable balance", () => {
    // 40 already refunded -> 60 refundable; full window refunds the remaining 60.
    const r = evaluateCancellationRefund({
      payment: { amount: 100, refunded_amount: 40 },
      appointmentDate: APPT,
      cancelledAt: hoursBefore(30),
    });
    expect(r).toEqual({ tier: "full", amount: 60, reasonCode: "FULL_REFUND_WINDOW" });
  });
});

describe("computeSettlement", () => {
  it("marks fully refunded on an exact full refund", () => {
    expect(computeSettlement({ amount: 100, refunded_amount: 0 }, 100)).toEqual({
      newRefundedAmount: 100,
      fullyRefunded: true,
    });
  });

  it("a partial refund is not fully refunded", () => {
    expect(computeSettlement({ amount: 100, refunded_amount: 0 }, 50)).toEqual({
      newRefundedAmount: 50,
      fullyRefunded: false,
    });
  });

  it("stacks onto a prior partial refund to reach full", () => {
    expect(computeSettlement({ amount: 100, refunded_amount: 50 }, 50)).toEqual({
      newRefundedAmount: 100,
      fullyRefunded: true,
    });
  });

  it("throws if the refund would exceed the captured amount", () => {
    expect(() => computeSettlement({ amount: 100, refunded_amount: 60 }, 50)).toThrow(/exceed/i);
  });

  it("rejects a non-positive refund amount", () => {
    expect(() => computeSettlement({ amount: 100, refunded_amount: 0 }, 0)).toThrow(/positive/i);
  });
});
