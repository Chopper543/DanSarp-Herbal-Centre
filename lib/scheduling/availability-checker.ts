/**
 * Doctor Availability Checker
 * Checks if a doctor is available at a specific time
 */

import { createClient } from "@/lib/supabase/server";

export interface AvailabilityCheckResult {
  available: boolean;
  reason?: string;
  conflictingAppointments?: any[];
}

/**
 * Check if a doctor is available at a specific date/time
 */
export async function checkDoctorAvailability(
  doctorId: string,
  requestedDateTime: Date,
  durationMinutes: number = 60
): Promise<AvailabilityCheckResult> {
  const supabase = await createClient();
  const endDateTime = new Date(requestedDateTime.getTime() + durationMinutes * 60 * 1000);

  // Check for time-off or holidays
  const requestedDate = requestedDateTime.toISOString().split("T")[0];
  const dayOfWeek = requestedDateTime.getDay();

  // @ts-ignore
  const { data: timeOff, error: timeOffError } = await supabase
    .from("doctor_availability")
    .select("*")
    .eq("doctor_id", doctorId)
    .eq("is_active", true)
    .in("type", ["time_off", "holiday", "emergency"])
    .or(`start_date.lte.${requestedDate},end_date.gte.${requestedDate}`);

  if (timeOff && timeOff.length > 0) {
    return {
      available: false,
      reason: `Doctor has ${timeOff[0].type.replace("_", " ")} scheduled`,
    };
  }

  // Check working hours
  // @ts-ignore
  const { data: workingHours, error: workingHoursError } = await supabase
    .from("doctor_availability")
    .select("*")
    .eq("doctor_id", doctorId)
    .eq("is_active", true)
    .eq("type", "working_hours")
    .eq("day_of_week", dayOfWeek);

  if (workingHours && workingHours.length > 0) {
    const schedule = workingHours[0];
    if (schedule.start_time && schedule.end_time) {
      const requestedTime = requestedDateTime.toTimeString().split(" ")[0];
      if (requestedTime < schedule.start_time || requestedTime > schedule.end_time) {
        return {
          available: false,
          reason: "Requested time is outside working hours",
        };
      }
    }
  }

  // Check for conflicting appointments
  // @ts-ignore
  const { data: appointments, error: appointmentsError } = await supabase
    .from("appointments")
    .select("*")
    .eq("status", "confirmed")
    .gte("appointment_date", requestedDateTime.toISOString())
    .lt("appointment_date", endDateTime.toISOString());

  // Note: This assumes appointments table has a doctor_id field
  // If not, you may need to join with another table or adjust the query
  const conflictingAppointments = appointments?.filter(
    (apt: any) => apt.doctor_id === doctorId || apt.user_id === doctorId
  );

  if (conflictingAppointments && conflictingAppointments.length > 0) {
    return {
      available: false,
      reason: "Doctor has a conflicting appointment",
      conflictingAppointments,
    };
  }

  return { available: true };
}

/**
 * Get available time slots for a doctor on a specific date
 */
export async function getAvailableTimeSlots(
  doctorId: string,
  date: Date,
  slotDurationMinutes: number = 60
): Promise<string[]> {
  const supabase = await createClient();
  const dayOfWeek = date.getDay();
  const dateString = date.toISOString().split("T")[0];

  // Get working hours for this day
  // @ts-ignore
  const { data: workingHours, error } = await supabase
    .from("doctor_availability")
    .select("*")
    .eq("doctor_id", doctorId)
    .eq("is_active", true)
    .eq("type", "working_hours")
    .eq("day_of_week", dayOfWeek)
    .single();

  if (error || !workingHours) {
    return []; // No working hours defined
  }

  const slots: string[] = [];
  if (workingHours.start_time && workingHours.end_time) {
    const start = new Date(`${dateString}T${workingHours.start_time}`);
    const end = new Date(`${dateString}T${workingHours.end_time}`);

    let current = new Date(start);
    while (current < end) {
      const slotEnd = new Date(current.getTime() + slotDurationMinutes * 60 * 1000);
      if (slotEnd <= end) {
        // Check if this slot is available
        const checkResult = await checkDoctorAvailability(doctorId, current, slotDurationMinutes);
        if (checkResult.available) {
          slots.push(current.toISOString());
        }
      }
      current = new Date(current.getTime() + slotDurationMinutes * 60 * 1000);
    }
  }

  return slots;
}
