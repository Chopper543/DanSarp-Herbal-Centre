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
      user:users!appointments_user_id_fkey (
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

  const typedAppointment = appointment as any;
  const user = typedAppointment.user as any;
  if (!user) {
    throw new Error("User not found");
  }

  const appointmentDate = new Date(typedAppointment.appointment_date);
  const now = new Date();

  for (const hoursBefore of preferences.reminderTiming) {
    const reminderTime = new Date(appointmentDate.getTime() - hoursBefore * 60 * 60 * 1000);

    if (reminderTime > now) {
      // Schedule reminder (in a real implementation, you'd use a job queue)
      // For now, we'll just send immediately if it's time
      if (reminderTime <= new Date(now.getTime() + 60000)) {
        // Within 1 minute of reminder time
        await sendReminder(typedAppointment, user, preferences);
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
    const apptDate = new Date(appointment.appointment_date);
    await sendAppointmentConfirmation(user.email, {
      date: apptDate.toLocaleDateString(),
      time: apptDate.toLocaleTimeString(),
      treatment: appointment.treatment_type,
      branch: "Main Branch",
    });
  }

  if (preferences.whatsapp && user.phone) {
    const apptDate = new Date(appointment.appointment_date);
    await sendAppointmentReminder(user.phone, {
      date: apptDate.toLocaleDateString(),
      time: apptDate.toLocaleTimeString(),
      treatment: appointment.treatment_type,
    });
  }
}
