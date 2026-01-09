import { PaymentMethod, PaymentStatus } from "@/types";

export interface PaymentRequest {
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  user_id: string;
  appointment_id?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  id: string;
  status: PaymentStatus;
  provider_transaction_id?: string;
  payment_url?: string;
  metadata?: Record<string, any>;
}

export interface PaymentProvider {
  name: string;
  processPayment(request: PaymentRequest): Promise<PaymentResponse>;
  verifyPayment(transactionId: string): Promise<PaymentResponse>;
  refundPayment(transactionId: string, amount: number): Promise<PaymentResponse>;
}

export class PaymentService {
  private providers: Map<string, PaymentProvider> = new Map();

  registerProvider(name: string, provider: PaymentProvider) {
    this.providers.set(name, provider);
  }

  async processPayment(
    provider: string,
    request: PaymentRequest
  ): Promise<PaymentResponse> {
    const paymentProvider = this.providers.get(provider);
    if (!paymentProvider) {
      throw new Error(`Payment provider ${provider} not found`);
    }

    return paymentProvider.processPayment(request);
  }

  async verifyPayment(
    provider: string,
    transactionId: string
  ): Promise<PaymentResponse> {
    const paymentProvider = this.providers.get(provider);
    if (!paymentProvider) {
      throw new Error(`Payment provider ${provider} not found`);
    }

    return paymentProvider.verifyPayment(transactionId);
  }

  async refundPayment(
    provider: string,
    transactionId: string,
    amount: number
  ): Promise<PaymentResponse> {
    const paymentProvider = this.providers.get(provider);
    if (!paymentProvider) {
      throw new Error(`Payment provider ${provider} not found`);
    }

    return paymentProvider.refundPayment(transactionId, amount);
  }
}

export const paymentService = new PaymentService();
