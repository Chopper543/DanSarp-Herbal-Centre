/**
 * Idempotent appointment creation for a completed, booking-fee payment.
 *
 * Shared by BOTH webhook handlers and the expire-pending cron, so whichever path
 * completes a payment also guarantees the appointment. The hard guarantee is a
 * DB constraint, not this code: `appointments_one_per_payment` (partial UNIQUE on
 * appointments.payment_id) makes the database accept at most one appointment per
 * payment. Two concurrent/duplicate runs both INSERT; one wins, the other gets a
 * unique violation and converges on the same row — no double-booking, no timing
 * assumption.
 *
 * IMPORTANT: unlike the previous per-handler copies, a genuine failure here
 * PROPAGATES (throws). Callers treat that as a processing failure so the webhook
 * event is retried rather than marked processed. (Caller audit confirmed no
 * external caller relied on the old silent-null-on-failure behavior.)
 *
 * The appointment shape is preserved exactly from the prior implementation; the
 * only addition is `payment_id`, which powers the unique guard.
 */
export async function ensureAppointmentForCompletedPayment(
  supabase: any,
  payment: any
): Promise<any | null> {
  const metadata = payment.metadata as any;
  if (
    !metadata?.appointment_data ||
    payment.appointment_id ||
    payment.status !== "completed" ||
    metadata.appointment_data.auto_create === false
  ) {
    return null;
  }

  const appointmentData = metadata.appointment_data;

  const { data: created, error } = await supabase
    .from("appointments")
    .insert({
      user_id: payment.user_id,
      branch_id: appointmentData.branch_id,
      appointment_date: appointmentData.appointment_date,
      treatment_type: appointmentData.treatment_type,
      notes: appointmentData.notes || null,
      status: "pending",
      payment_id: payment.id,
    })
    .select()
    .single();

  let appointment = created;

  if (error) {
    // Unique guard tripped: another delivery/worker already created THE
    // appointment for this payment. Converge on it instead of double-booking.
    if (error.code === "23505") {
      const { data: existing, error: fetchError } = await supabase
        .from("appointments")
        .select("*")
        .eq("payment_id", payment.id)
        .single();
      if (fetchError || !existing) {
        throw new Error(
          `Appointment unique-conflict but existing row not found: ${fetchError?.message || "no row"}`
        );
      }
      appointment = existing;
    } else {
      // Propagate — a failed appointment must fail the whole webhook so the event
      // is retried, not silently marked processed (the swallowed-failure bug).
      throw new Error(`Failed to create appointment from payment: ${error.message}`);
    }
  }

  // Link the payment back to its appointment. Idempotent: concurrent runs
  // converge on the same appointment id via the unique guard above.
  const { error: linkError } = await supabase
    .from("payments")
    .update({ appointment_id: appointment.id })
    .eq("id", payment.id);
  if (linkError) {
    throw new Error(`Failed to link payment to appointment: ${linkError.message}`);
  }

  return appointment;
}
