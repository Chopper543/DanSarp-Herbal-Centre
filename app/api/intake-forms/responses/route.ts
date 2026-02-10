import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin, isDoctor, isNurse } from "@/lib/auth/rbac";
import { sendEmail } from "@/lib/email/resend";
import { sendWhatsAppMessage } from "@/lib/whatsapp/twilio";
import { sanitizeText } from "@/lib/utils/sanitize";

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
    const responseId = searchParams.get("id");
    const formId = searchParams.get("form_id");
    const patientId = searchParams.get("patient_id");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);
    const isStaffReviewer = Boolean(
      isUserAdmin ||
        userRole === "appointment_manager" ||
        isDoctor(userRole) ||
        isNurse(userRole)
    );

    let query = supabase.from("intake_form_responses").select("*", { count: "exact" });

    // If requesting specific response
    if (responseId) {
      // @ts-ignore
      const { data: response, error } = await supabase
        .from("intake_form_responses")
        .select("*")
        .eq("id", responseId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Check permissions
      const typedResponse = response as { patient_id: string } | null;
      if (!isStaffReviewer && typedResponse?.patient_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      return NextResponse.json({ response }, { status: 200 });
    }

    // Filter by form_id
    if (formId) {
      query = query.eq("form_id", formId);
    }

    // Filter by patient_id if provided
    if (patientId) {
      if (!isStaffReviewer && patientId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      query = query.eq("patient_id", patientId);
    } else if (!isStaffReviewer) {
      // Regular users can only see their own responses
      query = query.eq("patient_id", user.id);
    }

    // Filter by status
    if (status) {
      query = query.eq("status", status);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to).order("created_at", { ascending: false });

    // @ts-ignore
    const { data: responses, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        responses: responses || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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
    const isStaffReviewer = Boolean(
      isUserAdmin ||
        userRole === "appointment_manager" ||
        isDoctor(userRole) ||
        isNurse(userRole)
    );

    const body = await request.json();
    const { id, status, review_notes } = body;

    if (!id) {
      return NextResponse.json({ error: "Response ID is required" }, { status: 400 });
    }

    // Check if response exists
    // @ts-ignore
    const { data: existingResponse, error: fetchError } = await supabase
      .from("intake_form_responses")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingResponse) {
      return NextResponse.json({ error: "Response not found" }, { status: 404 });
    }

    // Patients can only update their own draft responses
    const typedExistingResponse = existingResponse as { patient_id: string; status: string } | null;
    if (!isStaffReviewer && typedExistingResponse?.patient_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Patients can only update draft responses
    if (!isStaffReviewer && typedExistingResponse?.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft responses can be updated" },
        { status: 403 }
      );
    }

    // Build update payload
    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updatePayload.status = status;
      if (status === "submitted") {
        updatePayload.submitted_at = new Date().toISOString();
      }
    }

    // Clinical staff can review responses
    if (
      isStaffReviewer &&
      (status === "reviewed" || status === "approved" || status === "rejected")
    ) {
      updatePayload.reviewed_by = user.id;
      updatePayload.reviewed_at = new Date().toISOString();
      if (review_notes) {
        updatePayload.review_notes = review_notes;
      }
    }

    // @ts-ignore
    const { data: response, error } = await supabase
      .from("intake_form_responses")
      // @ts-ignore - Supabase type inference issue
      .update(updatePayload as any)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const updatedStatus = (response as any)?.status as string | undefined;
    const previousStatus = typedExistingResponse?.status;
    const patientId = typedExistingResponse?.patient_id;
    if (
      patientId &&
      isStaffReviewer &&
      updatedStatus &&
      ["reviewed", "approved", "rejected"].includes(updatedStatus) &&
      updatedStatus !== previousStatus
    ) {
      const { data: patient } = await supabase
        .from("users")
        .select("full_name, email, phone")
        .eq("id", patientId)
        .single();
      const typedPatient = patient as { full_name?: string; email?: string; phone?: string | null } | null;
      const safeReviewNotes = review_notes ? sanitizeText(review_notes) : "";
      const statusLabel = updatedStatus.charAt(0).toUpperCase() + updatedStatus.slice(1);

      if (typedPatient?.email) {
        sendEmail({
          to: typedPatient.email,
          subject: `Intake form review update: ${statusLabel}`,
          html: `<p>Hello ${typedPatient.full_name || "Patient"},</p><p>Your intake form response has been marked as <strong>${statusLabel}</strong>.</p>${safeReviewNotes ? `<p>Reviewer notes: ${safeReviewNotes}</p>` : ""}`,
        }).catch(() => {});
      }
      if (typedPatient?.phone) {
        sendWhatsAppMessage(
          typedPatient.phone,
          `DanSarp update: your intake form response is now ${statusLabel}.${safeReviewNotes ? ` Notes: ${safeReviewNotes}` : ""}`
        ).catch(() => {});
      }
    }

    return NextResponse.json({ response }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
