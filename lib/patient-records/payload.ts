import { z } from "zod";
import { sanitizeText } from "@/lib/utils/sanitize";

const GenderSchema = z.enum(["male", "female", "other", "prefer_not_to_say"]);
const MaritalStatusSchema = z.enum(["single", "married", "divorced", "widowed", "separated"]);

const MedicalHistoryEntrySchema = z
  .object({
    condition: z.string().min(1).max(500),
    started: z.string().date(),
    ended: z.string().date().optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  })
  .strict();

const DoctorNoteSchema = z
  .object({
    date: z.string().date(),
    doctor: z.string().min(1).max(200),
    report: z.string().min(1).max(8000),
    attachments: z.array(z.string().url()).max(20).optional().default([]),
  })
  .strict();

export const PatientRecordPayloadSchema = z
  .object({
    user_id: z.string().uuid().optional(),
    // Demographics
    date_of_birth: z.string().date().optional().nullable(),
    gender: GenderSchema.optional().nullable(),
    marital_status: MaritalStatusSchema.optional().nullable(),
    occupation: z.string().max(200).optional().nullable(),
    // Contact
    home_address: z.string().max(500).optional().nullable(),
    city: z.string().max(120).optional().nullable(),
    region: z.string().max(120).optional().nullable(),
    postal_code: z.string().max(30).optional().nullable(),
    alternative_phone: z.string().max(50).optional().nullable(),
    // Emergency contact
    emergency_contact_name: z.string().max(200).optional().nullable(),
    emergency_contact_phone: z.string().max(50).optional().nullable(),
    emergency_contact_relationship: z.string().max(100).optional().nullable(),
    // Clinical fields
    primary_condition: z.string().max(500).optional().nullable(),
    condition_started_date: z.string().date().optional().nullable(),
    medical_history: z.array(MedicalHistoryEntrySchema).max(200).optional().nullable(),
    allergies: z.array(z.string().max(200)).max(200).optional().nullable(),
    current_medications: z.array(z.string().max(200)).max(200).optional().nullable(),
    blood_type: z.string().max(10).optional().nullable(),
    doctor_notes: z.array(DoctorNoteSchema).max(300).optional().nullable(),
    // Additional fields
    insurance_provider: z.string().max(200).optional().nullable(),
    insurance_number: z.string().max(200).optional().nullable(),
    referral_source: z.string().max(200).optional().nullable(),
    preferred_language: z.string().max(20).optional().nullable(),
    notes: z.string().max(8000).optional().nullable(),
    // Legacy compatibility: map to home_address if present
    address: z.string().max(500).optional().nullable(),
  })
  .strict();

export type PatientRecordPayload = z.infer<typeof PatientRecordPayloadSchema>;
export type PatientRecordPayloadInput = Omit<PatientRecordPayload, "user_id">;

function sanitizeNullableText(value?: string | null): string | null {
  if (value == null) return null;
  const trimmed = `${value}`.trim();
  if (!trimmed) return null;
  return sanitizeText(trimmed);
}

function normalizeStringArray(values?: string[] | null): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => sanitizeNullableText(value))
    .filter((value): value is string => Boolean(value));
}

function normalizeMedicalHistory(entries?: PatientRecordPayloadInput["medical_history"]): Array<{
  condition: string;
  started: string;
  ended?: string;
  notes?: string;
}> {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => {
    const condition = sanitizeNullableText(entry.condition) || "";
    const notes = sanitizeNullableText(entry.notes);
    const ended = entry.ended || undefined;
    return {
      condition,
      started: entry.started,
      ...(ended ? { ended } : {}),
      ...(notes ? { notes } : {}),
    };
  });
}

function normalizeDoctorNotes(entries?: PatientRecordPayloadInput["doctor_notes"]): Array<{
  date: string;
  doctor: string;
  report: string;
  attachments?: string[];
}> {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => {
    const doctor = sanitizeNullableText(entry.doctor) || "";
    const report = sanitizeNullableText(entry.report) || "";
    const attachments = Array.isArray(entry.attachments)
      ? entry.attachments.filter((url) => Boolean(url?.trim()))
      : [];
    return {
      date: entry.date,
      doctor,
      report,
      ...(attachments.length ? { attachments } : {}),
    };
  });
}

export function normalizePatientRecordPayload(payload: PatientRecordPayloadInput) {
  const normalizedHomeAddress =
    sanitizeNullableText(payload.home_address) ?? sanitizeNullableText(payload.address);

  return {
    date_of_birth: payload.date_of_birth || null,
    gender: payload.gender || null,
    marital_status: payload.marital_status || null,
    occupation: sanitizeNullableText(payload.occupation),
    home_address: normalizedHomeAddress,
    city: sanitizeNullableText(payload.city),
    region: sanitizeNullableText(payload.region),
    postal_code: sanitizeNullableText(payload.postal_code),
    alternative_phone: sanitizeNullableText(payload.alternative_phone),
    emergency_contact_name: sanitizeNullableText(payload.emergency_contact_name),
    emergency_contact_phone: sanitizeNullableText(payload.emergency_contact_phone),
    emergency_contact_relationship: sanitizeNullableText(payload.emergency_contact_relationship),
    primary_condition: sanitizeNullableText(payload.primary_condition),
    condition_started_date: payload.condition_started_date || null,
    medical_history: normalizeMedicalHistory(payload.medical_history),
    allergies: normalizeStringArray(payload.allergies),
    current_medications: normalizeStringArray(payload.current_medications),
    blood_type: sanitizeNullableText(payload.blood_type),
    doctor_notes: normalizeDoctorNotes(payload.doctor_notes),
    insurance_provider: sanitizeNullableText(payload.insurance_provider),
    insurance_number: sanitizeNullableText(payload.insurance_number),
    referral_source: sanitizeNullableText(payload.referral_source),
    preferred_language: sanitizeNullableText(payload.preferred_language) || "en",
    notes: sanitizeNullableText(payload.notes),
  };
}

export function normalizePatientRecordUpdatePayload(
  payload: Partial<PatientRecordPayloadInput>
) {
  const normalized: Record<string, unknown> = {};

  if ("date_of_birth" in payload) normalized.date_of_birth = payload.date_of_birth || null;
  if ("gender" in payload) normalized.gender = payload.gender || null;
  if ("marital_status" in payload) normalized.marital_status = payload.marital_status || null;
  if ("occupation" in payload) normalized.occupation = sanitizeNullableText(payload.occupation);

  if ("home_address" in payload || "address" in payload) {
    normalized.home_address =
      sanitizeNullableText(payload.home_address) ?? sanitizeNullableText(payload.address) ?? null;
  }
  if ("city" in payload) normalized.city = sanitizeNullableText(payload.city);
  if ("region" in payload) normalized.region = sanitizeNullableText(payload.region);
  if ("postal_code" in payload) normalized.postal_code = sanitizeNullableText(payload.postal_code);
  if ("alternative_phone" in payload) {
    normalized.alternative_phone = sanitizeNullableText(payload.alternative_phone);
  }

  if ("emergency_contact_name" in payload) {
    normalized.emergency_contact_name = sanitizeNullableText(payload.emergency_contact_name);
  }
  if ("emergency_contact_phone" in payload) {
    normalized.emergency_contact_phone = sanitizeNullableText(payload.emergency_contact_phone);
  }
  if ("emergency_contact_relationship" in payload) {
    normalized.emergency_contact_relationship = sanitizeNullableText(payload.emergency_contact_relationship);
  }

  if ("primary_condition" in payload) {
    normalized.primary_condition = sanitizeNullableText(payload.primary_condition);
  }
  if ("condition_started_date" in payload) {
    normalized.condition_started_date = payload.condition_started_date || null;
  }
  if ("medical_history" in payload) {
    normalized.medical_history = normalizeMedicalHistory(payload.medical_history);
  }
  if ("allergies" in payload) {
    normalized.allergies = normalizeStringArray(payload.allergies);
  }
  if ("current_medications" in payload) {
    normalized.current_medications = normalizeStringArray(payload.current_medications);
  }
  if ("blood_type" in payload) {
    normalized.blood_type = sanitizeNullableText(payload.blood_type);
  }
  if ("doctor_notes" in payload) {
    normalized.doctor_notes = normalizeDoctorNotes(payload.doctor_notes);
  }

  if ("insurance_provider" in payload) {
    normalized.insurance_provider = sanitizeNullableText(payload.insurance_provider);
  }
  if ("insurance_number" in payload) {
    normalized.insurance_number = sanitizeNullableText(payload.insurance_number);
  }
  if ("referral_source" in payload) {
    normalized.referral_source = sanitizeNullableText(payload.referral_source);
  }
  if ("preferred_language" in payload) {
    normalized.preferred_language = sanitizeNullableText(payload.preferred_language) || "en";
  }
  if ("notes" in payload) {
    normalized.notes = sanitizeNullableText(payload.notes);
  }

  return normalized;
}
