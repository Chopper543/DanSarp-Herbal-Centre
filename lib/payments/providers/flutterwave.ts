import { PaymentProvider, PaymentRequest, PaymentResponse } from "../payment-service";
import { PaymentStatus } from "@/types";

export class FlutterwaveProvider implements PaymentProvider {
  name = "flutterwave";
  private secretKey: string;
  private publicKey: string;

  constructor() {
    this.secretKey = process.env.FLUTTERWAVE_SECRET_KEY || "";
    this.publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY || "";
  }

  private assertConfigured() {
    if (!this.secretKey || !this.publicKey) {
      throw new Error("Flutterwave credentials not configured");
    }
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    this.assertConfigured();
    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: `dansarp-${Date.now()}`,
        amount: request.amount,
        currency: request.currency,
        redirect_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/appointments/payment`,
        customer: {
          email: request.metadata?.email || "",
          name: request.metadata?.name || "",
        },
        meta: request.metadata,
      }),
    });

    const data = await response.json();

    if (data.status !== "success") {
      throw new Error(data.message || "Payment initialization failed");
    }

    return {
      id: String(data.data.tx_ref),
      status: "pending",
      provider_transaction_id: String(data.data.tx_ref),
      payment_url: data.data.link,
      metadata: data.data,
    };
  }

  async verifyPayment(transactionId: string): Promise<PaymentResponse> {
    this.assertConfigured();
    const isNumericTransactionId = /^\d+$/.test(transactionId);
    const verifyUrl = isNumericTransactionId
      ? `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`
      : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(transactionId)}`;
    const response = await fetch(verifyUrl, {
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
      },
    });

    const data = await response.json();

    if (data.status !== "success") {
      throw new Error(data.message || "Payment verification failed");
    }

    const status: PaymentStatus =
      data.data.status === "successful" ? "completed" : "failed";

    return {
      id: String(data.data.tx_ref),
      status,
      provider_transaction_id: String(data.data.tx_ref),
      metadata: data.data,
    };
  }

  async refundPayment(transactionId: string, amount: number): Promise<PaymentResponse> {
    this.assertConfigured();
    const response = await fetch("https://api.flutterwave.com/v3/transactions/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: transactionId,
        amount,
      }),
    });

    const data = await response.json();

    if (data.status !== "success") {
      throw new Error(data.message || "Refund failed");
    }

    return {
      id: data.data.id.toString(),
      status: "refunded",
      provider_transaction_id: transactionId,
      metadata: data.data,
    };
  }
}
