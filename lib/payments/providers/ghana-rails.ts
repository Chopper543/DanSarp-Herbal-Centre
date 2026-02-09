import { PaymentProvider, PaymentRequest, PaymentResponse } from "../payment-service";
import { PaymentMethod, PaymentStatus } from "@/types";

export class GhanaRailsProvider implements PaymentProvider {
  name = "custom";

  private readonly MERCHANT_MOMO_NUMBER =
    process.env.GHANA_RAILS_MERCHANT_MOMO || "0246225405";
  private readonly BANK_ACCOUNT = process.env.GHANA_RAILS_BANK_ACCOUNT || "0000000000";
  private readonly BANK_NAME = process.env.GHANA_RAILS_BANK_NAME || "Your Bank";
  private readonly BANK_ACCOUNT_NAME =
    process.env.GHANA_RAILS_BANK_ACCOUNT_NAME || "DanSarp Herbal Centre";
  private readonly GHQR_STRING = process.env.GHANA_RAILS_GHQR_STRING;

  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    const transactionId = `gh-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const referenceCode = `REF-${transactionId}`;

    if (["mtn_momo", "vodafone_cash", "airteltigo"].includes(request.payment_method)) {
      const phoneNumber = (request as any).phone_number || request.metadata?.phone_number;

      if (!phoneNumber) {
        throw new Error("Phone number is required for mobile money payments");
      }

      return {
        id: transactionId,
        status: "pending",
        provider_transaction_id: transactionId,
        metadata: {
          ...(request.metadata || {}),
          provider_status: "pending",
          payment_method: request.payment_method,
          phone_number: phoneNumber,
          merchant_number: this.MERCHANT_MOMO_NUMBER,
          amount: request.amount,
          currency: request.currency,
          instructions: `Authorize the mobile money prompt sent to ${phoneNumber}. Funds go to ${this.MERCHANT_MOMO_NUMBER}.`,
          callback_hint: "Provider will send webhook to /api/payments/ghana-rails/webhook",
        reference_code: referenceCode,
        },
      };
    }

    if (request.payment_method === "ghqr") {
      const ghqrPayload =
        this.GHQR_STRING ||
        `GHQR-${transactionId}-${request.amount}-${request.currency || "GHS"}`;

      return {
        id: transactionId,
        status: "pending",
        provider_transaction_id: transactionId,
        payment_url: undefined,
        metadata: {
          ...(request.metadata || {}),
          provider_status: "pending",
          payment_method: request.payment_method,
          ghqr_payload: ghqrPayload,
          instructions:
            "Scan the GHQR payload with your banking app to complete payment. Status will update automatically when the provider callback is received.",
        reference_code: referenceCode,
        },
      };
    }

    if (request.payment_method === "bank_transfer") {
      return {
        id: transactionId,
        status: "pending",
        provider_transaction_id: transactionId,
        metadata: {
          ...(request.metadata || {}),
          provider_status: "pending",
          payment_method: request.payment_method,
          bank_account_name: this.BANK_ACCOUNT_NAME,
          bank_account_number: this.BANK_ACCOUNT,
          bank_name: this.BANK_NAME,
          instructions: `Transfer GHS ${request.amount} to ${this.BANK_ACCOUNT_NAME} (${this.BANK_NAME} - ${this.BANK_ACCOUNT}). Use reference ${referenceCode} and add your phone or email.`,
          reference_code: referenceCode,
        },
      };
    }

    return {
      id: transactionId,
      status: "pending",
      provider_transaction_id: transactionId,
      metadata: {
        ...(request.metadata || {}),
        provider_status: "pending",
        payment_method: request.payment_method,
        instructions: this.getPaymentInstructions(request.payment_method),
        reference_code: referenceCode,
      },
    };
  }

  async verifyPayment(transactionId: string): Promise<PaymentResponse> {
    // Without direct provider polling, rely on provider status set via webhook.
    return {
      id: transactionId,
      status: "pending",
      provider_transaction_id: transactionId,
      metadata: {
        provider_status: "pending",
        message: "Awaiting provider callback/webhook",
      },
    };
  }

  async refundPayment(transactionId: string, amount: number): Promise<PaymentResponse> {
    return {
      id: transactionId,
      status: "refunded",
      provider_transaction_id: transactionId,
      metadata: { refund_amount: amount },
    };
  }

  private getPaymentInstructions(method: PaymentMethod): string {
    const instructions: Record<PaymentMethod, string> = {
      mtn_momo: "Send payment to MTN Mobile Money number: 0244XXXXXX",
      vodafone_cash: "Send payment to Vodafone Cash number: 020XXXXXXX",
      airteltigo: "Send payment to AirtelTigo Money number: 027XXXXXXX",
      bank_transfer: "Transfer to Account: XXXX XXXX XXXX, Bank: XXX",
      card: "Complete payment using your card",
      ghqr: "Scan the QR code to complete payment",
      wallet: "Complete payment from your wallet",
      cod: "Pay on delivery",
    };

    return instructions[method] || "Follow the payment instructions provided";
  }
}
