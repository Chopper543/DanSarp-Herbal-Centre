import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendAppointmentReminder } from "@/lib/whatsapp/twilio";
import { sendAppointmentConfirmation } from "@/lib/email/resend";

/**
 * Vercel Cron endpoint for sending appointment reminders
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/appointment-reminders",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  // Verify this is a cron request (optional: add authentication)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    // Find appointments scheduled for tomorrow (24h reminder)
    // @ts-ignore
    const { data: appointments24h, error: error24h } = await supabase
      .from("appointments")
      .select(`
        *,
        users!appointments_user_id_fkey (
          id,
          email,
          phone,
          full_name
        )
      `)
      .eq("status", "confirmed")
      .gte("appointment_date", tomorrow.toISOString())
      .lt("appointment_date", dayAfterTomorrow.toISOString());

    if (error24h) {
      console.error("Error fetching 24h reminders:", error24h);
    }

    // Send reminders
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    if (appointments24h) {
      for (const appointment of appointments24h) {
        try {
          const user = appointment.users;
          if (!user) continue;

          // Send email reminder
          if (user.email) {
            await sendAppointmentConfirmation({
              email: user.email,
              name: user.full_name || "Patient",
              appointmentDate: new Date(appointment.appointment_date),
              treatmentType: appointment.treatment_type,
            });
          }

          // Send WhatsApp reminder
          if (user.phone) {
            await sendAppointmentReminder({
              phone: user.phone,
              appointmentDate: new Date(appointment.appointment_date),
              treatmentType: appointment.treatment_type,
            });
          }

          results.sent++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`Appointment ${appointment.id}: ${error.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
