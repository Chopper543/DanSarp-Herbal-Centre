import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin } from "@/lib/auth/rbac";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || (isUserAdmin ? "all" : "inbox"); // inbox, sent, all (admin only), or appointment
    const appointmentId = searchParams.get("appointment_id");
    const unreadOnly = searchParams.get("unread_only") === "true";

    // @ts-ignore - Supabase type inference issue with messages table
    let query = supabase
      .from("messages")
      .select(`
        *,
        sender:users!messages_sender_id_fkey(full_name, email),
        recipient:users!messages_recipient_id_fkey(full_name, email)
      `);

    // Admins can see all messages, regular users see only their own
    if (isUserAdmin && type === "all") {
      // Admin viewing all messages - no filter
    } else if (type === "inbox") {
      query = query.eq("recipient_id", user.id);
    } else if (type === "sent") {
      query = query.eq("sender_id", user.id);
    }

    if (appointmentId) {
      query = query.eq("appointment_id", appointmentId);
    }

    if (unreadOnly) {
      query = query.eq("is_read", false);
    }

    // @ts-ignore - Supabase type inference issue with messages table
    const { data: messages, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ messages: messages || [] }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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
    const { recipient_id, appointment_id, subject, content } = body;

    if (!recipient_id || !subject || !content) {
      return NextResponse.json(
        { error: "recipient_id, subject, and content are required" },
        { status: 400 }
      );
    }

    // Get sender's role
    const senderRole = await getUserRole();
    
    // If sender is a patient (role="user"), check recipient is not a patient
    if (senderRole === "user") {
      // @ts-ignore - Supabase type inference issue with users table
      const { data: recipient } = await supabase
        .from("users")
        .select("role")
        .eq("id", recipient_id)
        .single();

      const typedRecipient = recipient as { role: string } | null;

      if (!typedRecipient) {
        return NextResponse.json(
          { error: "Recipient not found" },
          { status: 404 }
        );
      }

      // Block patient-to-patient messaging
      if (typedRecipient.role === "user") {
        return NextResponse.json(
          { error: "Patients can only message staff members. Please contact a staff member for assistance." },
          { status: 403 }
        );
      }
    }

    // @ts-ignore - Supabase type inference issue with messages table
    const { data: message, error } = await supabase
      .from("messages")
      // @ts-ignore - Supabase type inference issue with messages table
      .insert({
        sender_id: user.id,
        recipient_id,
        appointment_id: appointment_id || null,
        subject,
        content,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message }, { status: 201 });
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
    const { message_id, is_read } = body;

    if (!message_id) {
      return NextResponse.json({ error: "message_id is required" }, { status: 400 });
    }

    // @ts-ignore - Supabase type inference issue with messages table
    const { data: message, error: fetchError } = await supabase
      .from("messages")
      .select("*")
      .eq("id", message_id)
      .single();

    if (fetchError || !message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const typedMessage = message as { recipient_id: string } | null;

    if (!typedMessage) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Verify user is the recipient
    if (typedMessage.recipient_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // @ts-ignore - Supabase type inference issue with messages table
    const { data: updatedMessage, error } = await supabase
      .from("messages")
      // @ts-ignore - Supabase type inference issue with messages table
      .update({
        is_read: is_read !== undefined ? is_read : true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", message_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: updatedMessage }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
