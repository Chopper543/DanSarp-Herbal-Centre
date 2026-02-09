import { NextRequest, NextResponse } from "next/server";
import { scheduleAppointmentReminders } from "@/lib/notifications/reminder-service";
import { dispatchReminder } from "@/lib/notifications/reminder-dispatch";
import { isReminderQueueEnabled } from "@/lib/queue/reminders";
import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/monitoring/logger";

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
    const supabase = createServiceClient();
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
      .select("id")
      .eq("status", "confirmed")
      .gte("appointment_date", tomorrow.toISOString())
      .lt("appointment_date", dayAfterTomorrow.toISOString());

    if (error24h) {
      logger.error("Error fetching appointment reminders", error24h);
    }

    const queueEnabled = isReminderQueueEnabled();
    // Send reminders
    const results = {
      queued: 0,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    if (appointments24h) {
      for (const appointment of appointments24h as Array<{ id: string }>) {
        try {
          if (queueEnabled) {
            await scheduleAppointmentReminders(appointment.id, {
              email: true,
              sms: false,
              whatsapp: true,
              reminderTiming: [24, 2],
            });
            results.queued++;
          } else {
            // Serverless fallback when no worker runtime is available.
            await dispatchReminder(appointment.id, {
              email: true,
              sms: false,
              whatsapp: true,
              reminderTiming: [24],
            });
            results.sent++;
          }
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
