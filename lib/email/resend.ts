import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY ?? "");

export async function sendEmail({
  to,
  subject,
  html,
  from = process.env.RESEND_FROM_EMAIL || "noreply@dansarpherbal.com",
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }
  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error("Email sending error:", error);
    throw error;
  }
}

export async function sendAppointmentConfirmation(
  email: string,
  appointmentDetails: {
    date: string;
    time: string;
    treatment: string;
    branch: string;
  }
) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #22c55e; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Appointment Confirmed</h1>
          </div>
          <div class="content">
            <p>Dear Patient,</p>
            <p>Your appointment has been confirmed with DanSarp Herbal Centre.</p>
            <div class="details">
              <p><strong>Date:</strong> ${appointmentDetails.date}</p>
              <p><strong>Time:</strong> ${appointmentDetails.time}</p>
              <p><strong>Treatment:</strong> ${appointmentDetails.treatment}</p>
              <p><strong>Branch:</strong> ${appointmentDetails.branch}</p>
            </div>
            <p>We look forward to seeing you!</p>
            <p>Best regards,<br>DanSarp Herbal Centre</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: "Appointment Confirmation - DanSarp Herbal Centre",
    html,
  });
}
