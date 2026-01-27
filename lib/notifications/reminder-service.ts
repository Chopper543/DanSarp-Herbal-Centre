/**
 * Appointment Reminder Service
 * Handles scheduling and sending appointment reminders
 */

import { createClient } from "@/lib/supabase/server";
import { sendAppointmentReminder } from "@/lib/whatsapp/twilio";
import { sendAppointmentConfirmation } from "@/lib/email/resend";

export interface ReminderPreferences {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  reminderTiming: number[]; // Hours before appointment (e.g., [24, 48, 168] for 1 day, 2 days, 1 week)
}

export async function sendAppointmentReminders(
  appointmentId: string,
  preferences: ReminderPreferences
): Promise<void> {
  const supabase = await createClient();

  // @ts-ignore
  const { data: appointment, error } = await supabase
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
    .eq("id", appointmentId)
    .single();

  if (error || !appointment) {
    throw new Error("Appointment not found");
  }

  const user = appointment.users;
  if (!user) {
    throw new Error("User not found");
  }

  const appointmentDate = new Date(appointment.appointment_date);
  const now = new Date();

  for (const hoursBefore of preferences.reminderTiming) {
    const reminderTime = new Date(appointmentDate.getTime() - hoursBefore * 60 * 60 * 1000);

    if (reminderTime > now) {
      // Schedule reminder (in a real implementation, you'd use a job queue)
      // For now, we'll just send immediately if it's time
      if (reminderTime <= new Date(now.getTime() + 60000)) {
        // Within 1 minute of reminder time
        await sendReminder(appointment, user, preferences);
      }
    }
  }
}

async function sendReminder(
  appointment: any,
  user: any,
  preferences: ReminderPreferences
): Promise<void> {
  if (preferences.email && user.email) {
    await sendAppointmentConfirmation({
      email: user.email,
      name: user.full_name || "Patient",
      appointmentDate: new Date(appointment.appointment_date),
      treatmentType: appointment.treatment_type,
    });
  }

  if (preferences.whatsapp && user.phone) {
    await sendAppointmentReminder({
      phone: user.phone,
      appointmentDate: new Date(appointment.appointment_date),
      treatmentType: appointment.treatment_type,
    });
  }
}
