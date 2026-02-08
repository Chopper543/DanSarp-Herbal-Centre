import { createClient } from "@/lib/supabase/server";
import { enqueueReminderJob } from "@/lib/queue/reminders";
import { dispatchReminder, ReminderPreferences } from "@/lib/notifications/reminder-dispatch";

/**
 * Schedules appointment reminders via BullMQ with delay. Falls back to
 * immediate dispatch if queue configuration is missing or enqueue fails.
 */
export async function scheduleAppointmentReminders(
  appointmentId: string,
  preferences: ReminderPreferences
): Promise<void> {
  const supabase = await createClient();
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
      // Queue is unavailable or misconfigured; fallback to direct send to avoid losing reminder
      await dispatchReminder(appointmentId, preferences);
    }
  }
}
