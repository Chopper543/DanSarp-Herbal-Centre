import twilio from "twilio";

let twilioClient: ReturnType<typeof twilio> | null = null;

function getTwilioClient(): ReturnType<typeof twilio> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials are not set");
  }

  if (!twilioClient) {
    twilioClient = twilio(accountSid, authToken);
  }

  return twilioClient;
}

function getWhatsAppFromNumber(): string {
  return process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";
}

export async function sendWhatsAppMessage(
  to: string,
  message: string
) {
  try {
    const client = getTwilioClient();
    const whatsappNumber = getWhatsAppFromNumber();

    // Ensure phone number is in WhatsApp format
    const formattedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

    const result = await client.messages.create({
      from: whatsappNumber,
      to: formattedTo,
      body: message,
    });

    return result;
  } catch (error) {
    console.error("WhatsApp sending error:", error);
    throw error;
  }
}

export async function sendAppointmentReminder(
  phoneNumber: string,
  appointmentDetails: {
    date: string;
    time: string;
    treatment: string;
  }
) {
  const message = `Reminder: Your appointment at DanSarp Herbal Centre is scheduled for ${appointmentDetails.date} at ${appointmentDetails.time} for ${appointmentDetails.treatment}. We look forward to seeing you!`;

  return sendWhatsAppMessage(phoneNumber, message);
}
