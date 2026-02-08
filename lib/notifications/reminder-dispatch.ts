import { createClient } from "@/lib/supabase/server";
import { sendAppointmentReminder } from "@/lib/whatsapp/twilio";
import { sendAppointmentConfirmation } from "@/lib/email/resend";
import { sendAppointmentReminderSMS } from "@/lib/sms/vonage";

export interface ReminderPreferences {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  reminderTiming: number[]; // hours before appointment
}

/**
 * Fetches appointment + user and sends notifications across enabled channels.
 */
export async function dispatchReminder(
  appointmentId: string,
  preferences: ReminderPreferences
): Promise<void> {
  const supabase = await createClient();

  // @ts-ignore - Supabase type inference issue
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

  const apptDate = new Date(typedAppointment.appointment_date);

  if (preferences.email && user.email) {
    await sendAppointmentConfirmation(user.email, {
      date: apptDate.toLocaleDateString(),
      time: apptDate.toLocaleTimeString(),
      treatment: typedAppointment.treatment_type,
      branch: "Main Branch",
    });
  }

  if (preferences.whatsapp && user.phone) {
    await sendAppointmentReminder(user.phone, {
      date: apptDate.toLocaleDateString(),
      time: apptDate.toLocaleTimeString(),
      treatment: typedAppointment.treatment_type,
    });
  }

  if (preferences.sms && user.phone) {
    await sendAppointmentReminderSMS(user.phone, {
      date: apptDate.toLocaleDateString(),
      time: apptDate.toLocaleTimeString(),
      treatment: typedAppointment.treatment_type,
    });
  }
}
