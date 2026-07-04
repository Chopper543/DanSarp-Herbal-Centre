import type { ErrorEvent, EventHint, Breadcrumb, BreadcrumbHint } from "@sentry/nextjs";

/**
 * Healthcare context: events MUST NOT carry patient identifiers, contact
 * details, or clinical content. Sentry's default PII collection is disabled
 * and we scrub anything that slips through breadcrumbs or extra context.
 *
 * Keep field lists exhaustive — adding a new PHI column anywhere in the app
 * means adding it here too.
 */

const REDACTED = "[REDACTED]";

const PII_FIELD_NAMES = new Set([
  "email",
  "phone",
  "phone_number",
  "phonenumber",
  "mobile",
  "whatsapp",
  "address",
  "street",
  "city",
  "postcode",
  "postal_code",
  "zip",
  "dob",
  "date_of_birth",
  "birth_date",
  "ssn",
  "national_id",
  "ghana_card",
  "passport",
  "first_name",
  "last_name",
  "full_name",
  "name",
  "patient_name",
  "guardian_name",
  "next_of_kin",
]);

const PHI_FIELD_NAMES = new Set([
  "patient_id",
  "medical_record_number",
  "mrn",
  "diagnosis",
  "diagnoses",
  "symptoms",
  "prescription",
  "prescriptions",
  "medication",
  "medications",
  "dosage",
  "clinical_notes",
  "notes",
  "lab_results",
  "lab_result",
  "test_result",
  "vitals",
  "allergies",
  "conditions",
  "treatment",
  "treatment_plan",
  "appointment_notes",
]);

const CREDENTIAL_FIELD_NAMES = new Set([
  "password",
  "passwd",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "api_key",
  "apikey",
  "authorization",
  "cookie",
  "set-cookie",
  "x-csrf-token",
  "csrf-token",
  "two_factor_secret",
  "two_factor_code",
  "otp",
  "pin",
]);

const SENSITIVE_FIELDS = new Set<string>([
  ...PII_FIELD_NAMES,
  ...PHI_FIELD_NAMES,
  ...CREDENTIAL_FIELD_NAMES,
]);

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_FIELDS.has(key.toLowerCase());
}

function scrubObject(value: unknown, depth = 0): unknown {
  if (depth > 6) return REDACTED;
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return scrubString(value);
  if (typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map((item) => scrubObject(item, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(k)) {
      out[k] = REDACTED;
    } else {
      out[k] = scrubObject(v, depth + 1);
    }
  }
  return out;
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// E.164-ish: optional +, 8-15 digits. Matches typical Ghana numbers (e.g. +233244123456).
const PHONE_RE = /\+?\d[\d\s\-().]{7,}\d/g;
// Bearer / API key style tokens — long hex/base64 chunks.
const TOKEN_RE = /\b[A-Za-z0-9_-]{32,}\b/g;

function scrubString(input: string): string {
  if (!input) return input;
  return input
    .replace(EMAIL_RE, REDACTED)
    .replace(TOKEN_RE, REDACTED)
    .replace(PHONE_RE, REDACTED);
}

function scrubHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!headers) return headers;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = isSensitiveKey(k) ? REDACTED : v;
  }
  return out;
}

function scrubUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url, "http://placeholder.local");
    const params = u.searchParams;
    let changed = false;
    for (const key of Array.from(params.keys())) {
      if (isSensitiveKey(key)) {
        params.set(key, REDACTED);
        changed = true;
      }
    }
    if (!changed) return scrubString(url);
    return scrubString(u.pathname + (params.toString() ? `?${params.toString()}` : "") + u.hash);
  } catch {
    return scrubString(url);
  }
}

export function scrubSentryEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  // Drop default PII fields entirely.
  if (event.user) {
    event.user = { id: event.user.id };
  }

  if (event.request) {
    event.request.cookies = undefined;
    event.request.headers = scrubHeaders(event.request.headers as Record<string, string> | undefined);
    event.request.url = scrubUrl(event.request.url);
    if (event.request.data) {
      event.request.data = scrubObject(event.request.data);
    }
    if (event.request.query_string && typeof event.request.query_string === "string") {
      event.request.query_string = scrubString(event.request.query_string);
    }
  }

  if (event.extra) {
    event.extra = scrubObject(event.extra) as Record<string, unknown>;
  }
  if (event.contexts) {
    event.contexts = scrubObject(event.contexts) as typeof event.contexts;
  }
  if (event.tags) {
    event.tags = scrubObject(event.tags) as typeof event.tags;
  }
  if (event.message) {
    event.message = scrubString(event.message);
  }

  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = scrubString(ex.value);
    }
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((bc) => scrubBreadcrumb(bc) ?? bc).filter(Boolean) as typeof event.breadcrumbs;
  }

  return event;
}

export function scrubBreadcrumb(
  breadcrumb: Breadcrumb,
  _hint?: BreadcrumbHint
): Breadcrumb | null {
  // Drop noisy click breadcrumbs that may include patient-facing labels.
  if (breadcrumb.category === "ui.click" || breadcrumb.category === "ui.input") {
    return null;
  }

  const out: Breadcrumb = { ...breadcrumb };
  if (out.message) out.message = scrubString(out.message);
  if (out.data) {
    out.data = scrubObject(out.data) as Record<string, unknown>;
    // URLs commonly appear under "url" or "from"/"to" for navigation.
    if (typeof (out.data as any).url === "string") {
      (out.data as any).url = scrubUrl((out.data as any).url);
    }
  }
  return out;
}
