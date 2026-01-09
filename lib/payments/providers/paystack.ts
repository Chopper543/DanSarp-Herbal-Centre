import { PaymentProvider, PaymentRequest, PaymentResponse } from "../payment-service";
import { PaymentStatus } from "@/types";

export class PaystackProvider implements PaymentProvider {
  name = "paystack";
  private secretKey: string;
  private publicKey: string;

  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || "";
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY || "";
    
    if (!this.secretKey || !this.publicKey) {
      throw new Error("Paystack credentials not configured");
    }
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: request.amount * 100, // Convert to kobo
        email: request.metadata?.email || "",
        currency: request.currency,
        metadata: request.metadata,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/payments/callback`,
      }),
    });

    const data = await response.json();

    if (!data.status) {
      throw new Error(data.message || "Payment initialization failed");
    }

    return {
      id: data.data.reference,
      status: "pending",
      provider_transaction_id: data.data.reference,
      payment_url: data.data.authorization_url,
      metadata: data.data,
    };
  }

  async verifyPayment(transactionId: string): Promise<PaymentResponse> {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${transactionId}`,
      {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      }
    );

    const data = await response.json();

    if (!data.status) {
      throw new Error(data.message || "Payment verification failed");
    }

    const status: PaymentStatus =
      data.data.status === "success" ? "completed" : "failed";

    return {
      id: data.data.reference,
      status,
      provider_transaction_id: data.data.reference,
      metadata: data.data,
    };
  }

  async refundPayment(transactionId: string, amount: number): Promise<PaymentResponse> {
    const response = await fetch("https://api.paystack.co/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction: transactionId,
        amount: amount * 100, // Convert to kobo
      }),
    });

    const data = await response.json();

    if (!data.status) {
      throw new Error(data.message || "Refund failed");
    }

    return {
      id: data.data.id,
      status: "refunded",
      provider_transaction_id: transactionId,
      metadata: data.data,
    };
  }
}
