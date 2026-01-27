import { createClient } from "@/lib/supabase/server";

export type BookingPrerequisiteMissingItem =
  | "email_verification"
  | "full_name"
  | "phone"
  | "required_intake_forms";

export interface BookingPrerequisitesResult {
  emailVerified: boolean;
  profileComplete: {
    fullName: boolean;
    phone: boolean;
  };
  requiredForms: Array<{ id: string; name: string }>;
  missingRequiredForms: Array<{ id: string; name: string }>;
  missing: BookingPrerequisiteMissingItem[];
  canProceed: boolean;
}

export async function evaluateBookingPrerequisites(): Promise<BookingPrerequisitesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      emailVerified: false,
      profileComplete: { fullName: false, phone: false },
      requiredForms: [],
      missingRequiredForms: [],
      missing: ["email_verification", "full_name", "phone", "required_intake_forms"],
      canProceed: false,
    };
  }

  const emailVerified = user.email_confirmed_at !== null;

  // Fetch user profile fields from `users`
  // @ts-ignore
  const { data: userRow } = await supabase
    .from("users")
    .select("full_name, phone")
    .eq("id", user.id)
    .single();

  const typedUserRow = userRow as { full_name: string | null; phone: string | null } | null;
  const fullName = Boolean(typedUserRow?.full_name && String(typedUserRow.full_name).trim().length > 0);
  const phone = Boolean(typedUserRow?.phone && String(typedUserRow.phone).trim().length > 0);

  // Required intake forms
  // @ts-ignore
  const { data: requiredFormsRows } = await supabase
    .from("intake_forms")
    .select("id, name")
    .eq("is_active", true)
    .eq("required_for_booking", true);

  const requiredForms = (requiredFormsRows || []).map((f: any) => ({
    id: String(f.id),
    name: String(f.name),
  }));

  const requiredFormIds = new Set(requiredForms.map((f) => f.id));

  let completedFormIds = new Set<string>();
  if (requiredForms.length > 0) {
    // Treat any non-draft response as “completed enough” for booking.
    // @ts-ignore
    const { data: responses } = await supabase
      .from("intake_form_responses")
      .select("form_id, status")
      .eq("patient_id", user.id)
      .in("status", ["submitted", "reviewed", "approved", "rejected"]);

    const typedResponses = (responses as Array<{ form_id: string | null }> | null) || [];
    for (const r of typedResponses) {
      if (r?.form_id) completedFormIds.add(String(r.form_id));
    }
  }

  const missingRequiredForms = requiredForms.filter((f) => !completedFormIds.has(f.id));

  const missing: BookingPrerequisiteMissingItem[] = [];
  if (!emailVerified) missing.push("email_verification");
  if (!fullName) missing.push("full_name");
  if (!phone) missing.push("phone");
  if (requiredForms.length > 0 && missingRequiredForms.length > 0) missing.push("required_intake_forms");

  return {
    emailVerified,
    profileComplete: { fullName, phone },
    requiredForms,
    missingRequiredForms,
    missing,
    canProceed: missing.length === 0,
  };
}

