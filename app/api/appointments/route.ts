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
