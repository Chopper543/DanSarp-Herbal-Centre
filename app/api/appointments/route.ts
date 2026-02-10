import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendAppointmentConfirmation, sendEmail } from "@/lib/email/resend";
import { sendAppointmentReminder, sendWhatsAppMessage } from "@/lib/whatsapp/twilio";
import { getUserRole, isUserOnly } from "@/lib/auth/rbac";
import { evaluateBookingPrerequisites } from "@/lib/appointments/prerequisites";
import { isAdminAppointmentStatus } from "@/lib/appointments/status";
import { AppointmentRequestSchema } from "@/lib/validation/api-schemas";
import { sanitizeText } from "@/lib/utils/sanitize";
import { logAuditEvent } from "@/lib/audit/log";
import { logger } from "@/lib/monitoring/logger";

const requestInfoFrom = (request: NextRequest) => ({
  ip:
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    null,
  userAgent: request.headers.get("user-agent"),
  path: request.nextUrl.pathname,
});

const ADMIN_APPOINTMENT_ROLES = new Set(["super_admin", "admin", "appointment_manager"]);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is a regular user (not staff)
    const userRole = await getUserRole();
    if (!isUserOnly(userRole)) {
      return NextResponse.json(
        { error: "Staff members cannot book appointments. Please use the admin panel." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = AppointmentRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid appointment request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { branch_id, appointment_date, treatment_type, notes, payment_id } = parsed.data;

    // Enforce booking prerequisites (cannot be bypassed)
    const prereq = await evaluateBookingPrerequisites();
    if (!prereq.canProceed) {
      return NextResponse.json(
        {
          error:
            "Booking blocked. Please verify your email, add full name + phone, and submit required intake forms.",
          prerequisites: prereq,
        },
        { status: 403 }
      );
    }

    // Verify payment is provided and completed
    if (!payment_id) {
      return NextResponse.json(
        { error: "Payment is required to book an appointment. Please complete payment first." },
        { status: 400 }
      );
    }

    // Verify payment exists and is completed
    // @ts-ignore - Supabase type inference issue with payments table
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", payment_id)
      .eq("user_id", user.id)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: "Payment not found or invalid" },
        { status: 400 }
      );
    }

    const typedPayment = payment as { amount: number; status: string; currency: string } | null;

    // Verify payment amount is 100 GHS (booking fee)
    if (!typedPayment || parseFloat(typedPayment.amount.toString()) !== 100) {
      return NextResponse.json(
        { error: "Invalid payment amount. Booking fee must be 100 GHS" },
        { status: 400 }
      );
    }

    // Verify payment is completed
    if (typedPayment.status !== "completed") {
      return NextResponse.json(
        { error: "Payment must be completed before booking appointment" },
        { status: 400 }
      );
    }

    const appointmentDate = new Date(appointment_date);
    const windowStart = new Date(appointmentDate.getTime() - 60 * 60 * 1000);
    const windowEnd = new Date(appointmentDate.getTime() + 60 * 60 * 1000);

    // Prevent overlapping bookings within a 1-hour window at the same branch
    // @ts-ignore - Supabase type inference issue with appointments table
    const { data: conflictingAppointments } = await supabase
      .from("appointments")
      .select("id, appointment_date, status")
      .eq("branch_id", branch_id)
      .in("status", ["pending", "confirmed"])
      .gte("appointment_date", windowStart.toISOString())
      .lte("appointment_date", windowEnd.toISOString())
      .limit(1);

    if (conflictingAppointments && conflictingAppointments.length > 0) {
      return NextResponse.json(
        { error: "Selected time is unavailable. Please choose another slot." },
        { status: 409 }
      );
    }

    // Create appointment
    const { data: appointment, error } = await supabase
      .from("appointments")
      // @ts-ignore - Supabase type inference issue with appointments table
      .insert({
        user_id: user.id,
        branch_id,
        appointment_date,
        treatment_type,
        notes,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Link payment to appointment
    const typedAppointment = appointment as { id: string } | null;
    if (typedAppointment && payment_id) {
      // @ts-ignore - Supabase type inference issue with payments table
      const { error: linkError } = await supabase
        .from("payments")
        // @ts-ignore - Supabase type inference issue with payments table
        .update({ appointment_id: typedAppointment.id })
        .eq("id", payment_id);

      if (linkError) {
        // Roll back appointment to avoid orphaned bookings
        // @ts-ignore - Supabase type inference issue with appointments table
        await supabase.from("appointments").delete().eq("id", typedAppointment.id);
        return NextResponse.json(
          { error: "Failed to link payment to appointment. Please try again." },
          { status: 500 }
        );
      }
    }

    // Get user details for notifications
    // @ts-ignore - Supabase type inference issue with users table
    const { data: userData } = await supabase
      .from("users")
      .select("email, phone")
      .eq("id", user.id)
      .single();
    
    const typedUserData = userData as { email: string; phone: string | null } | null;

    // Get branch details
    // @ts-ignore - Supabase type inference issue with branches table
    const { data: branch } = await supabase
      .from("branches")
      .select("name")
      .eq("id", branch_id)
      .single();
    
    const typedBranch = branch as { name: string } | null;

    // Send email confirmation
    if (typedUserData?.email) {
      try {
        await sendAppointmentConfirmation(typedUserData.email, {
          date: new Date(appointment_date).toLocaleDateString(),
          time: new Date(appointment_date).toLocaleTimeString(),
          treatment: treatment_type,
          branch: typedBranch?.name || "Main Branch",
        });
      } catch (emailError) {
        logger.error("Failed to send appointment confirmation email", emailError);
      }
    }

    // Send WhatsApp notification if phone number exists
    if (typedUserData?.phone) {
      try {
        await sendAppointmentReminder(typedUserData.phone, {
          date: new Date(appointment_date).toLocaleDateString(),
          time: new Date(appointment_date).toLocaleTimeString(),
          treatment: treatment_type,
        });
      } catch (whatsappError) {
        logger.error("Failed to send WhatsApp reminder", whatsappError);
      }
    }

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const appointmentId = searchParams.get("id");
    const requestedAdminView = searchParams.get("admin") === "true";
    const requestedPatientId = searchParams.get("patient_id");
    const userRole = await getUserRole();
    const canAdminAppointments = Boolean(userRole && ADMIN_APPOINTMENT_ROLES.has(userRole));
    const isAdminView = requestedAdminView && canAdminAppointments;

    if (requestedAdminView && !canAdminAppointments) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If specific appointment ID is requested
    if (appointmentId) {
      // @ts-ignore - Supabase type inference issue with appointments table
      const { data: appointment, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", appointmentId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Verify user owns this appointment (unless admin)
      const typedAppointment = appointment as { user_id: string } | null;
      if (!isAdminView && typedAppointment && typedAppointment.user_id !== user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      return NextResponse.json({ appointments: [appointment] }, { status: 200 });
    }

    // Get all appointments
    // @ts-ignore - Supabase type inference issue with appointments table
    let query = supabase
      .from("appointments")
      .select(
        isAdminView
          ? "*, user:users!appointments_user_id_fkey(full_name, email)"
          : "*"
      );

    if (requestedPatientId) {
      if (!isAdminView && requestedPatientId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      query = query.eq("user_id", requestedPatientId);
    } else if (!isAdminView) {
      query = query.eq("user_id", user.id);
    }

    // @ts-ignore - Supabase type inference issue with appointments table
    const { data: appointments, error } = await query.order("appointment_date", {
      ascending: false,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // For admin, annotate each appointment with paid flag (completed payment with matching appointment_id)
    let annotatedAppointments: any[] = appointments || [];
    if (isAdminView && appointments && appointments.length > 0) {
      const appointmentIds = appointments.map((apt: any) => apt.id);
      // @ts-ignore - Supabase type inference issue with payments table
      const { data: paidPayments } = await supabase
        .from("payments")
        .select("appointment_id, status")
        .in("appointment_id", appointmentIds)
        .eq("status", "completed");

      const paidSet = new Set((paidPayments || []).map((p: any) => p.appointment_id));
      annotatedAppointments = appointments.map((apt: any) => ({
        ...apt,
        paid: paidSet.has(apt.id),
      }));
    }

    return NextResponse.json({ appointments: annotatedAppointments }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { appointment_id, action, appointment_date, cancellation_reason, status, status_note } = body;

    if (!appointment_id || !action) {
      return NextResponse.json(
        { error: "appointment_id and action are required" },
        { status: 400 }
      );
    }

    // Fetch the appointment to verify ownership and check date
    // @ts-ignore - Supabase type inference issue with appointments table
    const { data: appointment, error: fetchError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointment_id)
      .single();

    if (fetchError || !appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    const typedAppointment = appointment as {
      user_id: string;
      appointment_date: string;
      treatment_type: string;
      status: string;
      notes?: string | null;
    } | null;

    if (!typedAppointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Verify user owns this appointment (unless admin)
    const userRole = await getUserRole();
    const isAdmin = Boolean(userRole && ADMIN_APPOINTMENT_ROLES.has(userRole));

    if (!isAdmin && typedAppointment.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const appointmentDate = new Date(typedAppointment.appointment_date);
    const now = new Date();
    const hoursUntilAppointment = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (action === "update_status") {
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (!status || !isAdminAppointmentStatus(status)) {
        return NextResponse.json(
          { error: "status must be one of pending, confirmed, completed, cancelled" },
          { status: 400 }
        );
      }

      const { data: updatedAppointment, error: updateError } = await supabase
        .from("appointments")
        // @ts-ignore - Supabase type inference issue
        .update({
          status,
          notes: status_note
            ? `${typedAppointment.notes || ""}\n\n[Admin status note] ${sanitizeText(status_note)}`.trim()
            : typedAppointment.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointment_id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      const { data: patient } = await supabase
        .from("users")
        .select("full_name, email, phone")
        .eq("id", typedAppointment.user_id)
        .single();
      const typedPatient = patient as { full_name?: string; email?: string; phone?: string | null } | null;

      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
      const safeStatusNote = status_note ? sanitizeText(status_note) : "";
      if (typedPatient?.email) {
        sendEmail({
          to: typedPatient.email,
          subject: `Appointment status updated: ${statusLabel}`,
          html: `<p>Hello ${typedPatient.full_name || "Patient"},</p><p>Your appointment status is now <strong>${statusLabel}</strong>.</p>${safeStatusNote ? `<p>Note from admin: ${safeStatusNote}</p>` : ""}<p>Please log in for details.</p>`,
        }).catch(() => {});
      }
      if (typedPatient?.phone) {
        sendWhatsAppMessage(
          typedPatient.phone,
          `DanSarp update: your appointment status is now ${statusLabel}.${safeStatusNote ? ` Note: ${safeStatusNote}` : ""}`
        ).catch(() => {});
      }

      await logAuditEvent({
        userId: user.id,
        action: "admin_update_appointment_status",
        resourceType: "appointment",
        resourceId: appointment_id,
        metadata: {
          previous_status: typedAppointment.status,
          new_status: status,
          patient_id: typedAppointment.user_id,
          note: safeStatusNote || null,
        },
        requestInfo: requestInfoFrom(request),
      });

      return NextResponse.json({ appointment: updatedAppointment }, { status: 200 });
    }

    if (action === "reschedule") {
      if (!appointment_date) {
        return NextResponse.json(
          { error: "appointment_date is required for rescheduling" },
          { status: 400 }
        );
      }

      const newAppointmentDate = new Date(appointment_date);
      if (newAppointmentDate <= now) {
        return NextResponse.json(
          { error: "New appointment date must be in the future" },
          { status: 400 }
        );
      }

      // Self-service rescheduling for appointments >24 hours away
      // Request-based for appointments <24 hours away
      if (hoursUntilAppointment < 24 && !isAdmin) {
        // For near-term appointments, we could create a reschedule request
        // For now, we'll allow it but could enhance this later
      }

      // @ts-ignore - Supabase type inference issue with appointments table
      const { data: updatedAppointment, error: updateError } = await supabase
        .from("appointments")
        // @ts-ignore - Supabase type inference issue with appointments table
        .update({
          appointment_date: newAppointmentDate.toISOString(),
          status: "pending", // Reset to pending for admin confirmation
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointment_id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      // Send notification
      // @ts-ignore - Supabase type inference issue with users table
      const { data: userInfo } = await supabase
        .from("users")
        .select("email, phone")
        .eq("id", user.id)
        .single();

      const typedUserInfo = userInfo as { email: string; phone: string | null } | null;

      if (typedUserInfo?.email) {
        try {
          await sendAppointmentConfirmation(typedUserInfo.email, {
            date: newAppointmentDate.toLocaleDateString(),
            time: newAppointmentDate.toLocaleTimeString(),
            treatment: typedAppointment.treatment_type,
            branch: "Your Branch", // Could fetch branch name
          });
        } catch (emailError) {
          logger.error("Failed to send reschedule confirmation email", emailError);
        }
      }

      return NextResponse.json({ appointment: updatedAppointment }, { status: 200 });
    } else if (action === "cancel") {
      // Self-service cancellation for appointments >24 hours away
      // Request-based for appointments <24 hours away
      if (hoursUntilAppointment < 24 && !isAdmin) {
        // For near-term appointments, we could create a cancellation request
        // For now, we'll allow it but could enhance this later
      }

      // @ts-ignore - Supabase type inference issue with appointments table
      const { data: updatedAppointment, error: updateError } = await supabase
        .from("appointments")
        // @ts-ignore - Supabase type inference issue with appointments table
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointment_id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      return NextResponse.json({ appointment: updatedAppointment }, { status: 200 });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
