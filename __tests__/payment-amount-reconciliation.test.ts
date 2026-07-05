/**
 * @jest-environment node
 *
 * P1 — payment webhooks must reconcile the provider-verified amount against
 * the amount we charged before flipping a payment to "completed". Underpayment
 * and currency mismatches must be rejected so a clinical booking is never
 * auto-created off an unreconciled payment.
 */

import { reconcilePaymentAmount } from "../lib/payments/amount-reconciliation";

const payment = { amount: 100, currency: "GHS" }; // expected = 10000 minor units

describe("reconcilePaymentAmount — Paystack (minor units)", () => {
  it("accepts an exact match", () => {
    const r = reconcilePaymentAmount("paystack", { amount: 10000, currency: "GHS" }, payment);
    expect(r.ok).toBe(true);
    expect(r.expectedMinorUnits).toBe(10000);
    expect(r.reportedMinorUnits).toBe(10000);
  });

  it("accepts overpayment", () => {
    const r = reconcilePaymentAmount("paystack", { amount: 15000, currency: "GHS" }, payment);
    expect(r.ok).toBe(true);
  });

  it("rejects underpayment", () => {
    const r = reconcilePaymentAmount("paystack", { amount: 9999, currency: "GHS" }, payment);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/amount mismatch/i);
  });
});

describe("reconcilePaymentAmount — Flutterwave (major units)", () => {
  it("accepts an exact match (major units scaled to minor)", () => {
    const r = reconcilePaymentAmount("flutterwave", { amount: 100, currency: "GHS" }, payment);
    expect(r.ok).toBe(true);
    expect(r.reportedMinorUnits).toBe(10000);
  });

  it("rejects underpayment", () => {
    const r = reconcilePaymentAmount("flutterwave", { amount: 99, currency: "GHS" }, payment);
    expect(r.ok).toBe(false);
  });
});

describe("reconcilePaymentAmount — currency + edge cases", () => {
  it("rejects a currency mismatch even when the amount is right", () => {
    const r = reconcilePaymentAmount("paystack", { amount: 10000, currency: "USD" }, payment);
    expect(r.ok).toBe(false);
    expect(r.currencyOk).toBe(false);
    expect(r.reason).toMatch(/currency mismatch/i);
  });

  it("does not treat an absent currency as a mismatch", () => {
    const r = reconcilePaymentAmount("paystack", { amount: 10000 }, payment);
    expect(r.ok).toBe(true);
    expect(r.currencyOk).toBe(true);
  });

  it("rejects when the provider amount is missing", () => {
    const r = reconcilePaymentAmount("paystack", { currency: "GHS" }, payment);
    expect(r.ok).toBe(false);
    expect(r.reportedMinorUnits).toBeNull();
    expect(r.reason).toMatch(/missing/i);
  });

  it("parses a numeric string amount", () => {
    const r = reconcilePaymentAmount("flutterwave", { amount: "100", currency: "GHS" }, payment);
    expect(r.ok).toBe(true);
    expect(r.reportedMinorUnits).toBe(10000);
  });

  it("defaults expected currency to GHS when the payment row has null", () => {
    const r = reconcilePaymentAmount(
      "paystack",
      { amount: 10000, currency: "GHS" },
      { amount: 100, currency: null }
    );
    expect(r.ok).toBe(true);
  });
});
