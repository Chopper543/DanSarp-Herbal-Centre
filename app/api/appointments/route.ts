import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { evaluateCancellationRefund } from "@/lib/payments/refunds";
import { sendAppointmentConfirmation, sendEmail } from "@/lib/email/resend";
import { sendAppointmentReminder, sendWhatsAppMessage } from "@/lib/whatsapp/twilio";
import { getUserRole, isUserOnly } from "@/lib/auth/rbac";
import { evaluateBookingPrerequisites } from "@/lib/appointments/prerequisites";
import { isAdminAppointmentStatus } from "@/lib/appointments/status";
import { AppointmentRequestSchema } from "@/lib/validation/api-schemas";
import { sanitizeText } from "@/lib/utils/sanitize";
import { logAuditEvent } from "@/lib/audit/log";
import { logger } from "@/lib/monitoring/logger";
import { internalError, badRequest } from "@/lib/api/errors";

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

    // Verify payment is provided
    if (!payment_id) {
      return NextResponse.json(
        { error: "Payment is required to book an appointment. Please complete payment first." },
        { status: 400 }
      );
    }

    // Atomic payment-check + slot-reserve via book_appointment() RPC.
    // The function locks the payment row, validates status/amount/ownership,
    // inserts the appointment under a GIST EXCLUDE constraint that prevents
    // ±1h overlap at the same branch, and links the payment — all in one tx.
    const { data: appointment, error: rpcError } = await (supabase.rpc as any)(
      "book_appointment",
      {
        p_user_id: user.id,
        p_branch_id: branch_id,
        p_appointment_date: appointment_date,
        p_treatment_type: treatment_type,
        p_notes: notes ?? null,
        p_payment_id: payment_id,
      }
    );

    if (rpcError) {
      switch (rpcError.code) {
        case "P0001":
          return NextResponse.json(
            { code: "SLOT_TAKEN", error: "Selected time is unavailable. Please choose another slot." },
            { status: 409 }
          );
        case "P0002":
          return NextResponse.json(
            { code: "PAYMENT_NOT_COMPLETED", error: "Payment must be completed before booking appointment" },
            { status: 422 }
          );
        case "P0003":
          return NextResponse.json(
            { code: "PAYMENT_NOT_FOUND", error: "Payment not found, already used, or does not belong to you" },
            { status: 400 }
          );
        case "P0004":
          return NextResponse.json(
            { code: "PAYMENT_AMOUNT_INVALID", error: "Invalid payment amount. Booking fee must be 100 GHS" },
            { status: 400 }
          );
        default:
          logger.error("book_appointment RPC failed", rpcError);
          return NextResponse.json(
            { error: "Failed to book appointment" },
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

    // Fire-and-forget confirmations: a slow or unavailable email/WhatsApp
    // provider must never add latency to — or fail — the booking response.
    // Failures are logged; durable reminders run through the queue (cron path).
    if (typedUserData?.email) {
      sendAppointmentConfirmation(typedUserData.email, {
        date: new Date(appointment_date).toLocaleDateString(),
        time: new Date(appointment_date).toLocaleTimeString(),
        treatment: treatment_type,
        branch: typedBranch?.name || "Main Branch",
      }).catch((emailError) =>
        logger.error("Failed to send appointment confirmation email", emailError)
      );
    }

    if (typedUserData?.phone) {
      sendAppointmentReminder(typedUserData.phone, {
        date: new Date(appointment_date).toLocaleDateString(),
        time: new Date(appointment_date).toLocaleTimeString(),
        treatment: treatment_type,
      }).catch((whatsappError) =>
        logger.error("Failed to send WhatsApp reminder", whatsappError)
      );
    }

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error: any) {
    return internalError("/api/appointments", error);
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
        return badRequest("/api/appointments", error);
      }

      // Verify user owns this appointment (unless admin)
      const typedAppointment = appointment as { user_id: string } | null;
      if (!isAdminView && typedAppointment && typedAppointment.user_id !== user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      // Audit cross-user reads (admin viewing patient appointment).
      // Self-reads are skipped to avoid log noise.
      if (typedAppointment && typedAppointment.user_id !== user.id) {
        await logAuditEvent({
          userId: user.id,
          action: "read_appointment",
          resourceType: "appointment",
          resourceId: appointmentId,
          metadata: { patient_id: typedAppointment.user_id, admin_view: isAdminView },
          requestInfo: requestInfoFrom(request),
        });
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
      return badRequest("/api/appointments", error);
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

    // Audit cross-user appointment listings (admin browsing, or admin/patient
    // querying ?patient_id=X != self). Skip self-only listings.
    const auditedListing =
      isAdminView || (requestedPatientId && requestedPatientId !== user.id);
    if (auditedListing) {
      await logAuditEvent({
        userId: user.id,
        action: isAdminView && !requestedPatientId
          ? "admin_list_appointments"
          : "list_appointments_by_patient",
        resourceType: "appointment",
        metadata: {
          patient_id: requestedPatientId ?? null,
          result_count: annotatedAppointments.length,
          admin_view: isAdminView,
        },
        requestInfo: requestInfoFrom(request),
      });
    }

    return NextResponse.json({ appointments: annotatedAppointments }, { status: 200 });
  } catch (error: any) {
    return internalError("/api/appointments", error);
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
        return badRequest("/api/appointments", updateError);
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
        return badRequest("/api/appointments", updateError);
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
        // Fire-and-forget: don't block the reschedule response on the mailer.
        sendAppointmentConfirmation(typedUserInfo.email, {
          date: newAppointmentDate.toLocaleDateString(),
          time: newAppointmentDate.toLocaleTimeString(),
          treatment: typedAppointment.treatment_type,
          branch: "Your Branch", // Could fetch branch name
        }).catch((emailError) =>
          logger.error("Failed to send reschedule confirmation email", emailError)
        );
      }

      return NextResponse.json({ appointment: updatedAppointment }, { status: 200 });
    } else if (action === "cancel") {
      // Self-service cancellation for appointments >24 hours away
      // Request-based for appointments <24 hours away
      if (hoursUntilAppointment < 24 && !isAdmin) {
        // For near-term appointments, we could create a cancellation request
        // For now, we'll allow it but could enhance this later
      }

      const nowIso = new Date().toISOString();
      const cancelReason = typeof cancellation_reason === "string"
        ? sanitizeText(cancellation_reason).slice(0, 500)
        : null;

      // Setting cancelled_at frees the slot from the appointments_no_overlap
      // exclusion constraint while preserving the row for audit/refund tracing.
      // payments.appointment_id is left intact so refund reconciliation can find
      // the originating booking.
      // @ts-ignore - Supabase type inference issue with appointments table
      const { data: updatedAppointment, error: updateError } = await supabase
        .from("appointments")
        // @ts-ignore - Supabase type inference issue with appointments table
        .update({
          status: "cancelled",
          cancelled_at: nowIso,
          notes: cancelReason
            ? `${typedAppointment.notes || ""}\n\n[Cancellation reason] ${cancelReason}`.trim()
            : typedAppointment.notes,
          updated_at: nowIso,
        })
        .eq("id", appointment_id)
        .select()
        .single();

      if (updateError) {
        return badRequest("/api/appointments", updateError);
      }

      await logAuditEvent({
        userId: user.id,
        action: "appointment_cancelled",
        resourceType: "appointment",
        resourceId: appointment_id,
        metadata: {
          previous_status: typedAppointment.status,
          cancelled_by_admin: isAdmin,
          hours_until_appointment: Math.round(hoursUntilAppointment * 10) / 10,
          reason: cancelReason,
        },
        requestInfo: requestInfoFrom(request),
      });

      // Auto-create a pending refund request per the cancellation policy. Uses
      // the service client so the request is attributed to the patient
      // regardless of who cancelled, and so RLS can't block it. Never fails the
      // cancellation — that already succeeded above.
      try {
        // Cast to any: refund_requests / payments.refunded_amount aren't in the
        // generated Database type (codebase convention for newer tables).
        const service = createServiceClient() as any;
        const { data: paidPayment } = await service
          .from("payments")
          .select("id, amount, refunded_amount")
          .eq("appointment_id", appointment_id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const eligibility = evaluateCancellationRefund({
          payment: paidPayment as { amount: number; refunded_amount?: number | null } | null,
          appointmentDate: typedAppointment.appointment_date,
          cancelledAt: nowIso,
        });

        if (paidPayment && eligibility) {
          const { error: refundError } = await service.from("refund_requests").insert({
            payment_id: (paidPayment as any).id,
            appointment_id,
            requested_by: typedAppointment.user_id,
            status: "pending",
            tier: eligibility.tier,
            amount: eligibility.amount,
            reason: cancelReason || `Cancellation refund (${eligibility.reasonCode})`,
            metadata: {
              reason_code: eligibility.reasonCode,
              created_from: "appointment_cancellation",
            },
          } as any);
          // 23505 = a live refund request already exists for this payment → fine.
          if (refundError && refundError.code !== "23505") {
            logger.error("Failed to create refund request on cancellation", refundError);
          }
        }
      } catch (refundCreateError) {
        logger.error(
          "Refund request creation failed (cancellation still succeeded)",
          refundCreateError
        );
      }

      return NextResponse.json({ appointment: updatedAppointment }, { status: 200 });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    return internalError("/api/appointments", error);
  }
}
