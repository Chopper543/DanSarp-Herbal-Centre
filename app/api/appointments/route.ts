import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendAppointmentConfirmation } from "@/lib/email/resend";
import { sendAppointmentReminder } from "@/lib/whatsapp/twilio";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { branch_id, appointment_date, treatment_type, notes } = body;

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
        console.error("Failed to send email:", emailError);
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
        console.error("Failed to send WhatsApp:", whatsappError);
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
    const isAdmin = searchParams.get("admin") === "true";

    // @ts-ignore - Supabase type inference issue with appointments table
    let query = supabase.from("appointments").select("*");

    if (!isAdmin) {
      query = query.eq("user_id", user.id);
    }

    // @ts-ignore - Supabase type inference issue with appointments table
    const { data: appointments, error } = await query.order("appointment_date", {
      ascending: false,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ appointments }, { status: 200 });
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
    const { appointment_id, action, appointment_date, cancellation_reason } = body;

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

    const typedAppointment = appointment as { user_id: string; appointment_date: string; treatment_type: string; status: string } | null;

    if (!typedAppointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Verify user owns this appointment (unless admin)
    // @ts-ignore - Supabase type inference issue
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const typedUserData = userData as { role: string } | null;
    const isAdmin = typedUserData?.role && ["super_admin", "admin", "appointment_manager"].includes(typedUserData.role);

    if (!isAdmin && typedAppointment.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const appointmentDate = new Date(typedAppointment.appointment_date);
    const now = new Date();
    const hoursUntilAppointment = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

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
          console.error("Failed to send email:", emailError);
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
