import { PaymentProvider, PaymentRequest, PaymentResponse } from "../payment-service";
import { PaymentStatus } from "@/types";

export class PaystackProvider implements PaymentProvider {
  name = "paystack";
  private secretKey: string;
  private publicKey: string;
  private readonly MERCHANT_MOBILE_MONEY_NUMBER = "0246225405";

  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || "";
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY || "";
  }

  private assertConfigured() {
    if (!this.secretKey || !this.publicKey) {
      throw new Error("Paystack credentials not configured");
    }
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    this.assertConfigured();
    const cardRequest = request as any;
    
    // Handle Mobile Money payments
    if (["mtn_momo", "vodafone_cash", "airteltigo"].includes(request.payment_method)) {
      const phoneNumber = (request as any).phone_number || request.metadata?.phone_number;
      
      if (!phoneNumber) {
        throw new Error("Phone number is required for mobile money payments");
      }

      // Map payment methods to Paystack provider codes
      const providerMap: Record<string, string> = {
        mtn_momo: "mtn",
        vodafone_cash: "vod",
        airteltigo: "tgo"
      };

      const paystackProvider = providerMap[request.payment_method];
      
      if (!paystackProvider) {
        throw new Error(`Unsupported mobile money provider: ${request.payment_method}`);
      }

      try {
        // Use Paystack Charge API for mobile money
        const response = await fetch("https://api.paystack.co/charge", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: request.metadata?.email || "",
            amount: request.amount * 100, // Convert to pesewas
            currency: request.currency || "GHS",
            mobile_money: {
              phone: phoneNumber,
              provider: paystackProvider,
            },
            metadata: {
              ...request.metadata,
              merchant_number: this.MERCHANT_MOBILE_MONEY_NUMBER,
              payment_method: request.payment_method,
            },
          }),
        });

        const data = await response.json();

        if (!data.status) {
          throw new Error(data.message || "Mobile money payment initialization failed");
        }

        // Paystack returns status "pay_offline" for mobile money
        // The user needs to complete authorization on their phone
        const status: PaymentStatus = data.data.status === "success" ? "completed" : "pending";
        
        return {
          id: data.data.reference || data.data.id,
          status,
          provider_transaction_id: data.data.reference || data.data.id,
          metadata: {
            ...data.data,
            payment_method: request.payment_method,
            phone_number: phoneNumber,
            merchant_number: this.MERCHANT_MOBILE_MONEY_NUMBER,
            display_text: data.data.display_text || `A payment prompt has been sent to ${phoneNumber}. Please enter your Mobile Money PIN on your phone to complete the transaction.`,
            // Paystack mobile money response includes:
            // - reference: transaction reference
            // - display_text: message to show user
            // - status: "pay_offline" (pending) or "success" (if already completed)
          },
        };
      } catch (error: any) {
        throw new Error(`Mobile money payment failed: ${error.message}`);
      }
    }
    
    // Explicitly reject raw card details to avoid PCI scope. Clients must use
    // Paystack's hosted page or tokenization.
    if (cardRequest.card_number || cardRequest.card_expiry || cardRequest.card_name || cardRequest.card_pin) {
      throw new Error(
        "Raw card details are not accepted. Use Paystack hosted payment or client-side tokenization."
      );
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
    this.assertConfigured();
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
      data.data.status === "success" ? "completed" : 
      data.data.status === "failed" ? "failed" : "pending";

    return {
      id: data.data.reference,
      status,
      provider_transaction_id: data.data.reference,
      metadata: data.data,
    };
  }

  async refundPayment(transactionId: string, amount: number): Promise<PaymentResponse> {
    this.assertConfigured();
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
