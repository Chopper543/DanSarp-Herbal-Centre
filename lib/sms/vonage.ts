import { Vonage } from '@vonage/server-sdk';
import { formatPhoneForSupabase } from '@/lib/utils/phone-format';

if (!process.env.VONAGE_API_KEY || !process.env.VONAGE_API_SECRET) {
  throw new Error("Vonage credentials are not set");
}

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET,
});

const fromNumber = process.env.VONAGE_FROM_NUMBER || "Vonage APIs";

/**
 * Sends an SMS message using Vonage API
 * @param to - Phone number in local format (024XXXXXXXX) or international format (+233XXXXXXXXX)
 * @param text - Message text to send
 * @returns Promise with SMS response
 */
export async function sendSMS(to: string, text: string) {
  try {
    // Format phone number to E.164 format for Vonage
    const formattedTo = formatPhoneForSupabase(to, false);
    
    // Vonage expects phone number without + prefix for some APIs, but SMS API accepts E.164
    // Remove + for Vonage SMS API (it expects format like 233XXXXXXXXX)
    const vonageTo = formattedTo.startsWith('+') ? formattedTo.slice(1) : formattedTo;

    const response = await vonage.sms.send({
      to: vonageTo,
      from: fromNumber,
      text: text,
    });

    // Check if message was sent successfully
    if (response.messages && response.messages[0].status === '0') {
      console.log('SMS sent successfully:', {
        to: formattedTo,
        messageId: response.messages[0]['message-id'],
      });
      return response;
    } else {
      const errorMessage = (response.messages?.[0] as any)?.['error-text'] || (response.messages?.[0] as any)?.errorText || 'Unknown error';
      throw new Error(`Failed to send SMS: ${errorMessage}`);
    }
  } catch (error: any) {
    console.error("Vonage SMS sending error:", error);
    throw error;
  }
}

/**
 * Sends an appointment reminder SMS
 * @param phoneNumber - Phone number in local or international format
 * @param appointmentDetails - Appointment details
 * @returns Promise with SMS response
 */
export async function sendAppointmentReminderSMS(
  phoneNumber: string,
  appointmentDetails: {
    date: string;
    time: string;
    treatment: string;
  }
) {
  const message = `Reminder: Your appointment at DanSarp Herbal Centre is scheduled for ${appointmentDetails.date} at ${appointmentDetails.time} for ${appointmentDetails.treatment}. We look forward to seeing you!`;

  return sendSMS(phoneNumber, message);
}

/**
 * Test function to send SMS (for development/testing)
 * @param phoneNumber - Phone number to test with
 * @param message - Optional custom message, defaults to test message
 */
export async function testSendSMS(phoneNumber: string, message?: string) {
  const testMessage = message || 'A text message sent using the Vonage SMS API';
  
  try {
    console.log('Testing SMS send to:', phoneNumber);
    const result = await sendSMS(phoneNumber, testMessage);
    console.log('Test SMS sent successfully');
    console.log('Response:', result);
    return result;
  } catch (error) {
    console.error('Test SMS failed:', error);
    throw error;
  }
}
