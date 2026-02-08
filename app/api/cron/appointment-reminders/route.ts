import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scheduleAppointmentReminders } from "@/lib/notifications/reminder-service";

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
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }
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

    type AppointmentWithUser = {
      id: string;
      appointment_date: string;
      treatment_type: string;
      user: {
        id: string;
        email: string | null;
        phone: string | null;
        full_name: string | null;
      } | null;
    };

    // Find appointments scheduled for tomorrow (24h reminder)
    // @ts-ignore
    const { data: appointments24h, error: error24h } = await supabase
      .from("appointments")
      .select(`
        *,
        user:users!appointments_user_id_fkey (
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
      for (const appointment of appointments24h as unknown as AppointmentWithUser[]) {
        try {
          await scheduleAppointmentReminders(appointment.id, {
            email: true,
            sms: false,
            whatsapp: true,
            reminderTiming: [24],
          });
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
