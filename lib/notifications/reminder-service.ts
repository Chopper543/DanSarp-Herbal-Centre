import { createServiceClient } from "@/lib/supabase/service";
import { enqueueReminderJob, isReminderQueueEnabled } from "@/lib/queue/reminders";
import { dispatchReminder, ReminderPreferences } from "@/lib/notifications/reminder-dispatch";
import { logger } from "@/lib/monitoring/logger";

/**
 * Schedules appointment reminders via BullMQ with delay. Falls back to
 * immediate dispatch if queue configuration is missing or enqueue fails.
 */
export async function scheduleAppointmentReminders(
  appointmentId: string,
  preferences: ReminderPreferences
): Promise<void> {
  const supabase = createServiceClient();
  // Fetch minimal appointment data to compute schedule windows
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("id, appointment_date")
    .eq("id", appointmentId)
    .single();

  if (error || !appointment) {
    throw new Error("Appointment not found");
  }

  const appointmentDate = new Date((appointment as any).appointment_date);
  const now = new Date();
  const queueEnabled = isReminderQueueEnabled();

  for (const hoursBefore of preferences.reminderTiming) {
    const reminderTime = new Date(appointmentDate.getTime() - hoursBefore * 60 * 60 * 1000);
    if (reminderTime <= now) {
      // Skip reminders that would trigger in the past
      continue;
    }

    const delayMs = reminderTime.getTime() - now.getTime();
    // If the reminder is due in the next minute, send immediately
    if (delayMs <= 60_000) {
      await dispatchReminder(appointmentId, preferences);
      continue;
    }

    if (!queueEnabled) {
      // Serverless-safe fallback: do not fire early when queue is disabled.
      logger.warn("Skipping delayed reminder because BullMQ is disabled", {
        appointmentId,
        hoursBefore,
        reminderTime: reminderTime.toISOString(),
      });
      continue;
    }

    try {
      await enqueueReminderJob(
        {
          appointmentId,
          preferences,
          triggerAt: reminderTime.toISOString(),
        },
        delayMs
      );
    } catch (err) {
      logger.error("Failed to enqueue reminder job", err);
    }
  }
}
