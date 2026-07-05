/**
 * Defense-in-depth amount/currency reconciliation for payment webhooks.
 *
 * The charged amount is set server-side at initialization, so a signed webhook
 * shouldn't be able to complete a payment for the wrong amount — but verifying
 * the provider-reported figure against what we expected before flipping a
 * payment to "completed" guards against underpayment, tampered/mis-routed
 * transactions, and provider-side bugs. A clinical booking should never be
 * auto-created off an unreconciled payment.
 *
 * Unit conventions differ by provider:
 *  - Paystack reports `amount` in MINOR units (pesewas/kobo).
 *  - Flutterwave reports `amount` in MAJOR units (e.g. GHS).
 */

export interface AmountReconciliation {
  ok: boolean;
  expectedMinorUnits: number;
  reportedMinorUnits: number | null;
  currencyOk: boolean;
  reason?: string;
}

export function reconcilePaymentAmount(
  provider: "paystack" | "flutterwave",
  verifiedMetadata: Record<string, any> | null | undefined,
  payment: { amount: number; currency: string | null }
): AmountReconciliation {
  const expectedMinorUnits = Math.round(payment.amount * 100);
  const meta = verifiedMetadata || {};

  const expectedCurrency = (payment.currency || "GHS").toString().toUpperCase();
  const reportedCurrency = (meta.currency || "").toString().toUpperCase();
  // Absent currency in the verification payload is not treated as a mismatch.
  const currencyOk = !reportedCurrency || reportedCurrency === expectedCurrency;

  const rawAmount = meta.amount;
  const reportedMajor =
    typeof rawAmount === "number"
      ? rawAmount
      : rawAmount != null && !Number.isNaN(Number(rawAmount))
        ? Number(rawAmount)
        : null;

  const reportedMinorUnits =
    reportedMajor == null
      ? null
      : provider === "flutterwave"
        ? Math.round(reportedMajor * 100)
        : Math.round(reportedMajor); // paystack already minor units

  if (reportedMinorUnits == null) {
    return {
      ok: false,
      expectedMinorUnits,
      reportedMinorUnits: null,
      currencyOk,
      reason: "provider amount missing from verification response",
    };
  }

  // Exact match or overpayment is acceptable; underpayment is not.
  const amountOk = reportedMinorUnits >= expectedMinorUnits;

  if (!amountOk || !currencyOk) {
    return {
      ok: false,
      expectedMinorUnits,
      reportedMinorUnits,
      currencyOk,
      reason: !currencyOk
        ? `currency mismatch: expected ${expectedCurrency}, got ${reportedCurrency || "<none>"}`
        : `amount mismatch: expected >= ${expectedMinorUnits}, got ${reportedMinorUnits}`,
    };
  }

  return { ok: true, expectedMinorUnits, reportedMinorUnits, currencyOk };
}
