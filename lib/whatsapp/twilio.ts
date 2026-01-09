import twilio from "twilio";

if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
  throw new Error("Twilio credentials are not set");
}

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

export async function sendWhatsAppMessage(
  to: string,
  message: string
) {
  try {
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
