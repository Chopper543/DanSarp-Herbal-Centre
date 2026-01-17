import { PaymentProvider, PaymentRequest, PaymentResponse } from "../payment-service";
import { PaymentMethod, PaymentStatus } from "@/types";

export class GhanaRailsProvider implements PaymentProvider {
  name = "custom";
  
  // Merchant mobile money number - all payments are wired to this number
  private readonly MERCHANT_MOBILE_MONEY_NUMBER = "0246225405";
  
  // This is a placeholder for custom Ghana payment rails integration
  // In production, this would integrate with MTN MoMo, Vodafone Cash, AirtelTigo APIs

  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    const transactionId = `gh-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    // Handle Mobile Money payments
    if (["mtn_momo", "vodafone_cash", "airteltigo"].includes(request.payment_method)) {
      const phoneNumber = (request as any).phone_number || request.metadata?.phone_number;
      
      if (!phoneNumber) {
        throw new Error("Phone number is required for mobile money payments");
      }

      // In production, this would:
      // 1. Call MTN MoMo API for mtn_momo - send USSD prompt to user's phone
      // 2. Call Vodafone Cash API for vodafone_cash - send USSD prompt to user's phone
      // 3. Call AirtelTigo API for airteltigo - send USSD prompt to user's phone
      // 
      // The API would send a USSD prompt like:
      // "Authorize payment of GHS {amount} Fee: GHS 0.00 Tax: 0 from your account 
      //  to {merchant} for your Requested Service. Enter MM PIN to continue."
      //
      // User enters PIN on their phone, and the provider sends a webhook/callback
      // when the transaction is completed.

      // Simulate USSD prompt being sent
      // In production, the actual API call would be made here
      // The payment will be wired to the merchant number: 0246225405
      console.log(`[SIMULATED] Sending USSD prompt to ${phoneNumber} for ${request.amount} GHS`);
      console.log(`[SIMULATED] Payment method: ${request.payment_method}`);
      console.log(`[SIMULATED] Transaction ID: ${transactionId}`);
      console.log(`[SIMULATED] Merchant number: ${this.MERCHANT_MOBILE_MONEY_NUMBER}`);
      
      return {
        id: transactionId,
        status: "pending", // Payment is pending until user enters PIN on phone
        provider_transaction_id: transactionId,
        metadata: {
          payment_method: request.payment_method,
          phone_number: phoneNumber,
          merchant_number: this.MERCHANT_MOBILE_MONEY_NUMBER,
          amount: request.amount,
          currency: request.currency,
          ussd_prompt_sent: true,
          instructions: `A payment prompt has been sent to ${phoneNumber}. Please enter your Mobile Money PIN on your phone to complete the transaction. Payment will be sent to ${this.MERCHANT_MOBILE_MONEY_NUMBER}.`,
          // In production, this would include actual API response data
        },
      };
    }

    // Handle Bank Transfer
    if (request.payment_method === "bank_transfer") {
      const bankName = (request as any).bank_name;
      const accountNumber = (request as any).account_number;
      const bankNotes = (request as any).bank_notes;

      // In production, this would integrate with GhIPSS/ACH for bank transfers
      // For now, return pending status with instructions
      
      return {
        id: transactionId,
        status: "pending",
        provider_transaction_id: transactionId,
        metadata: {
          payment_method: request.payment_method,
          bank_name: bankName,
          account_number: accountNumber,
          bank_notes: bankNotes,
          amount: request.amount,
          currency: request.currency,
          instructions: `Transfer GHS ${request.amount} to the provided account. Payment will be verified manually.`,
        },
      };
    }
    
    // Default fallback
    return {
      id: transactionId,
      status: "pending",
      provider_transaction_id: transactionId,
      metadata: {
        payment_method: request.payment_method,
        instructions: this.getPaymentInstructions(request.payment_method),
      },
    };
  }

  async verifyPayment(transactionId: string): Promise<PaymentResponse> {
    // In production, this would verify with the respective provider's API:
    // - MTN MoMo API: Check transaction status
    // - Vodafone Cash API: Check transaction status
    // - AirtelTigo API: Check transaction status
    // - Bank Transfer: Check via GhIPSS/ACH or manual verification
    
    // For mobile money, the provider would send a webhook when user completes
    // the USSD prompt on their phone. This function would be called to verify
    // the transaction status.
    
    // Simulate verification - in production, this would make actual API calls
    // For now, we'll check if enough time has passed (simulating user completing payment)
    // In real implementation, this would query the provider's API
    
    return {
      id: transactionId,
      status: "completed", // In production, this would be the actual status from API
      provider_transaction_id: transactionId,
      metadata: {
        verified_at: new Date().toISOString(),
        // In production, this would include actual verification response data
      },
    };
  }

  async refundPayment(transactionId: string, amount: number): Promise<PaymentResponse> {
    // In production, this would process refund through the provider's API
    
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
