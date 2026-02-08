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

export async function sendAdminInviteEmail(params: {
  to: string;
  inviteLink: string;
  role: string;
  invitedBy?: string | null;
  from?: string;
}) {
  const { to, inviteLink, role, invitedBy, from } = params;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #111827; background: #f3f4f6; }
          .container { max-width: 640px; margin: 0 auto; padding: 24px; }
          .card { background: #ffffff; border-radius: 12px; padding: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
          .title { color: #0f172a; margin: 0 0 12px 0; }
          .pill { display: inline-block; padding: 6px 12px; background: #e0f2fe; color: #0369a1; border-radius: 999px; font-size: 12px; font-weight: 600; }
          .button { display: inline-block; margin-top: 16px; padding: 12px 20px; background: #16a34a; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; }
          .muted { color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <p class="pill">Admin invite</p>
            <h1 class="title">You’ve been invited to DanSarp Herbal Centre</h1>
            <p>Hello,</p>
            <p>${invitedBy ? `${invitedBy} has` : "An administrator has"} invited you to join the admin workspace with the <strong>${role.replace("_", " ")}</strong> role.</p>
            <p>Click the button below to accept the invitation. The link will expire in 7 days.</p>
            <a class="button" href="${inviteLink}">Accept invitation</a>
            <p class="muted">If the button doesn’t work, paste this link into your browser:</p>
            <p class="muted">${inviteLink}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: "You’re invited to DanSarp Herbal Centre admin",
    html,
    from,
  });
}
