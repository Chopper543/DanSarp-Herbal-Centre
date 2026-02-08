import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin } from "@/lib/auth/rbac";

async function getDepartmentRecipientId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  department: string
) {
  type RoleList = string[];
  const departmentRoles: Record<string, RoleList> = {
    care_team: ["doctor", "nurse"],
    billing: ["finance_manager"],
    admin: ["admin", "super_admin", "content_manager", "appointment_manager"],
  };

  const roles = departmentRoles[department];
  if (!roles || roles.length === 0) return null;

  for (const role of roles) {
    // @ts-ignore - Supabase type inference issue with users table
    const { data: staff } = await supabase
      .from("users")
      .select("id")
      .eq("role", role)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const typedStaff = staff as { id: string } | null;
    if (typedStaff?.id) {
      return typedStaff.id;
    }
  }

  return null;
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

    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || (isUserAdmin ? "all" : "inbox"); // inbox, sent, all (admin only), or appointment
    const appointmentId = searchParams.get("appointment_id");
    const unreadOnly = searchParams.get("unread_only") === "true";
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
    const page = Math.max(Number(searchParams.get("page")) || 1, 1);
    const offset = (page - 1) * limit;

    // @ts-ignore - Supabase type inference issue with messages table
    let query = supabase
      .from("messages")
      .select(
        `
        id,
        sender_id,
        recipient_id,
        appointment_id,
        subject,
        content,
        is_read,
        created_at,
        sender:users!messages_sender_id_fkey(id, full_name, email),
        recipient:users!messages_recipient_id_fkey(id, full_name, email)
      `,
        { count: "exact" }
      );

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
    const { data: messages, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        messages: messages || [],
        pagination: {
          total: count ?? 0,
          page,
          limit,
          totalPages: count ? Math.ceil(count / limit) : 1,
        },
      },
      { status: 200 }
    );
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
    const { recipient_id, department, appointment_id, subject, content } = body;

    if ((!recipient_id && !department) || !subject || !content) {
      return NextResponse.json(
        { error: "recipient_id or department, subject, and content are required" },
        { status: 400 }
      );
    }

    // Get sender's role
    const senderRole = await getUserRole();

    let resolvedRecipientId = recipient_id as string | null;

    // If patient uses department, resolve staff recipient
    if (senderRole === "user" && !resolvedRecipientId && department) {
      const recipientFromDept = await getDepartmentRecipientId(
        supabase,
        String(department).toLowerCase()
      );

      if (!recipientFromDept) {
        return NextResponse.json(
          { error: "No staff available for the selected department. Please try another department." },
          { status: 400 }
        );
      }

      resolvedRecipientId = recipientFromDept;
    }

    // If sender is a patient and still no resolved recipient, or recipient provided directly
    if (senderRole === "user" && resolvedRecipientId) {
      // @ts-ignore - Supabase type inference issue with users table
      const { data: recipient } = await supabase
        .from("users")
      .select("role")
        .eq("id", resolvedRecipientId)
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

    if (!resolvedRecipientId) {
      return NextResponse.json(
        { error: "Unable to determine recipient. Please select a department." },
        { status: 400 }
      );
    }

    // @ts-ignore - Supabase type inference issue with messages table
    const { data: message, error } = await supabase
      .from("messages")
      // @ts-ignore - Supabase type inference issue with messages table
      .insert({
        sender_id: user.id,
        recipient_id: resolvedRecipientId,
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
