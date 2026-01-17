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
    const cardRequest = request as any;
    
    // Check if card details are provided for direct card charging
    if (cardRequest.card_number && cardRequest.card_expiry && cardRequest.card_name && cardRequest.card_pin) {
      // For direct card charging, we would use Paystack's charge API
      // However, for security and PCI compliance, Paystack recommends using their
      // hosted payment page or tokenization. For this implementation, we'll use
      // the charge API with card details.
      
      // Note: In production, card details should be tokenized on the client side
      // using Paystack's inline.js or sent securely to avoid PCI compliance issues
      
      try {
        // First, get authorization URL for card payment
        // Paystack requires card tokenization for security
        // For this implementation, we'll initialize a transaction that will
        // redirect to Paystack's secure payment page where user enters card details
        
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
            metadata: {
              ...request.metadata,
              // Don't include card PIN in metadata for security
              card_last4: cardRequest.card_number.slice(-4),
            },
            callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/appointments/payment`,
          }),
        });

        const data = await response.json();

        if (!data.status) {
          throw new Error(data.message || "Payment initialization failed");
        }

        // Return payment URL - user will be redirected to Paystack's secure page
        // where they can enter card details securely
        return {
          id: data.data.reference,
          status: "pending",
          provider_transaction_id: data.data.reference,
          payment_url: data.data.authorization_url,
          metadata: {
            ...data.data,
            card_last4: cardRequest.card_number.slice(-4),
            // Card details are NOT stored in metadata for security
          },
        };
      } catch (error: any) {
        throw new Error(`Card payment failed: ${error.message}`);
      }
    }

    // Standard payment initialization (without card details)
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
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/appointments/payment`,
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
