import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, isAdmin } from "@/lib/auth/rbac";
import { z } from "zod";

const IntakeFormResponsePayloadSchema = z
  .object({
    appointment_id: z.string().uuid().optional().nullable(),
    response_data: z.record(z.any()),
    status: z.enum(["draft", "submitted", "reviewed", "approved", "rejected"]).optional(),
  })
  .strict();

function isEmptyResponseValue(value: any) {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function validateResponseDataAgainstSchema(
  responseData: Record<string, any>,
  formSchema: any,
  enforceRequiredFields: boolean
) {
  const errors: string[] = [];
  const fields = Array.isArray(formSchema?.fields) ? formSchema.fields : null;
  if (!fields) {
    return ["Form schema is invalid or missing fields"];
  }

  const allowedNames = new Set(
    fields
      .map((field: any) => field?.name)
      .filter((name: unknown): name is string => typeof name === "string" && name.trim().length > 0)
  );

  for (const key of Object.keys(responseData || {})) {
    if (!allowedNames.has(key)) {
      errors.push(`Unexpected field: ${key}`);
    }
  }

  for (const field of fields) {
    const fieldName = String(field?.name || "").trim();
    if (!fieldName) continue;

    const value = responseData?.[fieldName];
    if (enforceRequiredFields && field?.required && isEmptyResponseValue(value)) {
      errors.push(`Required field missing: ${fieldName}`);
      continue;
    }

    if (isEmptyResponseValue(value)) {
      continue;
    }

    const fieldType = field?.type;
    const options = Array.isArray(field?.options) ? field.options : [];

    if (fieldType === "checkbox") {
      if (!Array.isArray(value)) {
        errors.push(`Field ${fieldName} must be an array`);
        continue;
      }
      if (options.length > 0 && value.some((item) => !options.includes(item))) {
        errors.push(`Field ${fieldName} contains invalid option(s)`);
      }
      continue;
    }

    if (fieldType === "number") {
      const numericValue =
        typeof value === "number"
          ? value
          : typeof value === "string" && value.trim() !== ""
            ? Number(value)
            : NaN;
      if (Number.isNaN(numericValue)) {
        errors.push(`Field ${fieldName} must be a number`);
      }
      continue;
    }

    if (typeof value !== "string") {
      errors.push(`Field ${fieldName} must be a string`);
      continue;
    }

    if ((fieldType === "select" || fieldType === "radio") && options.length > 0 && !options.includes(value)) {
      errors.push(`Field ${fieldName} must match one of the allowed options`);
    }
    if (fieldType === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      errors.push(`Field ${fieldName} must use YYYY-MM-DD format`);
    }
    if (
      fieldType === "email" &&
      !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)
    ) {
      errors.push(`Field ${fieldName} must be a valid email address`);
    }
  }

  return errors;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patient_id");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);

    let query = supabase
      .from("intake_form_responses")
      .select("*", { count: "exact" })
      .eq("form_id", id);

    // Filter by patient_id if provided
    if (patientId) {
      if (!isUserAdmin && patientId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      query = query.eq("patient_id", patientId);
    } else if (!isUserAdmin) {
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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = IntakeFormResponsePayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid intake response payload", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { appointment_id, response_data, status } = parsed.data;
    const normalizedStatus = status || "draft";

    // Validation
    if (!response_data || typeof response_data !== "object") {
      return NextResponse.json(
        { error: "Response data is required" },
        { status: 400 }
      );
    }

    // Verify form exists and is active
    // @ts-ignore
    const { data: form, error: formError } = await supabase
      .from("intake_forms")
      .select("*")
      .eq("id", id)
      .single();

    if (formError || !form) {
      return NextResponse.json({ error: "Intake form not found" }, { status: 404 });
    }

    // Check if form is active (for non-admins)
    const userRole = await getUserRole();
    const isUserAdmin = userRole && isAdmin(userRole);
    const typedForm = form as { is_active: boolean; form_schema: any } | null;
    if (!isUserAdmin && !typedForm?.is_active) {
      return NextResponse.json({ error: "This form is not currently active" }, { status: 403 });
    }

    const validationErrors = validateResponseDataAgainstSchema(
      response_data,
      typedForm?.form_schema,
      normalizedStatus !== "draft"
    );
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Response data does not match form schema",
          details: validationErrors,
        },
        { status: 400 }
      );
    }

    // Check if user already has a draft response
    // @ts-ignore
    const { data: existingResponse } = await supabase
      .from("intake_form_responses")
      .select("*")
      .eq("form_id", id)
      .eq("patient_id", user.id)
      .eq("status", "draft")
      .single();

    let responseData: any;
    const typedExistingResponse = existingResponse as { id: string } | null;
    if (typedExistingResponse) {
      // Update existing draft
      responseData = {
        response_data,
        status: normalizedStatus,
        submitted_at: normalizedStatus === "submitted" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      // @ts-ignore
      const { data: updatedResponse, error: updateError } = await supabase
        .from("intake_form_responses")
        // @ts-ignore - Supabase type inference issue
        .update(responseData as any)
        .eq("id", typedExistingResponse.id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      return NextResponse.json({ response: updatedResponse }, { status: 200 });
    } else {
      // Create new response
      responseData = {
        form_id: id,
        patient_id: user.id,
        appointment_id: appointment_id || null,
        response_data,
        status: normalizedStatus,
        submitted_at: normalizedStatus === "submitted" ? new Date().toISOString() : null,
      };

      // @ts-ignore
      const { data: newResponse, error: insertError } = await supabase
        .from("intake_form_responses")
        // @ts-ignore - Supabase type inference issue
        .insert(responseData as any)
        .select()
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 });
      }

      return NextResponse.json({ response: newResponse }, { status: 201 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
