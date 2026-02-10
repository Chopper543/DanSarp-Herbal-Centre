import { isAdminAppointmentStatus } from "@/lib/appointments/status";

describe("Admin appointment status policy", () => {
  it("accepts only allowed admin status transitions", () => {
    expect(isAdminAppointmentStatus("pending")).toBe(true);
    expect(isAdminAppointmentStatus("confirmed")).toBe(true);
    expect(isAdminAppointmentStatus("completed")).toBe(true);
    expect(isAdminAppointmentStatus("cancelled")).toBe(true);
  });

  it("rejects invalid appointment statuses", () => {
    expect(isAdminAppointmentStatus("rescheduled")).toBe(false);
    expect(isAdminAppointmentStatus("draft")).toBe(false);
    expect(isAdminAppointmentStatus("")).toBe(false);
  });
});
