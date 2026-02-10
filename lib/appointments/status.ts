export const ADMIN_APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
] as const;

export type AdminAppointmentStatus = (typeof ADMIN_APPOINTMENT_STATUSES)[number];

export function isAdminAppointmentStatus(value: string): value is AdminAppointmentStatus {
  return (ADMIN_APPOINTMENT_STATUSES as readonly string[]).includes(value);
}
